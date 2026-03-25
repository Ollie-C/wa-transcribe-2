from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient

from app.main import app, settings


class MainApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_readiness_reports_ready_dependencies(self) -> None:
        with (
            patch('app.main._fetch_ollama_tags', new=AsyncMock(return_value=[settings.llm_model])),
            patch('app.main.get_whisper_model', new=AsyncMock(return_value=object())),
        ):
            response = self.client.get('/health/readiness')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'ready')
        self.assertTrue(payload['ollama']['ready'])
        self.assertTrue(payload['llm_model']['ready'])
        self.assertTrue(payload['whisper']['ready'])

    def test_readiness_reports_missing_model(self) -> None:
        with (
            patch('app.main._fetch_ollama_tags', new=AsyncMock(return_value=['other-model:latest'])),
            patch('app.main.get_whisper_model', new=AsyncMock(return_value=object())),
        ):
            response = self.client.get('/health/readiness')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'degraded')
        self.assertEqual(payload['llm_model']['status'], 'missing')
        self.assertIn('ollama pull', payload['llm_model']['detail'])

    def test_readiness_reports_ollama_offline(self) -> None:
        request = httpx.Request('GET', f'{settings.llm_base_url}/api/tags')

        with (
            patch('app.main._fetch_ollama_tags', new=AsyncMock(side_effect=httpx.ConnectError('offline', request=request))),
            patch('app.main.get_whisper_model', new=AsyncMock(return_value=object())),
        ):
            response = self.client.get('/health/readiness')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'degraded')
        self.assertEqual(payload['ollama']['status'], 'offline')

    def test_transcribe_returns_actionable_whisper_error(self) -> None:
        with patch(
            'app.main.transcribe_file',
            new=AsyncMock(side_effect=RuntimeError('faster-whisper is not installed')),
        ):
            response = self.client.post(
                '/api/transcribe',
                files={'file': ('clip.webm', b'audio-bytes', 'audio/webm')},
            )

        self.assertEqual(response.status_code, 500)
        self.assertIn('faster-whisper is not installed', response.json()['detail'])

    def test_refine_returns_actionable_ollama_error(self) -> None:
        request = httpx.Request('POST', f'{settings.llm_base_url}/api/chat')

        with patch(
            'app.main.complete_text',
            new=AsyncMock(side_effect=httpx.ConnectError('offline', request=request)),
        ):
            response = self.client.post(
                '/api/refine',
                json={'text': 'hello', 'instructions': 'clean this up'},
            )

        self.assertEqual(response.status_code, 502)
        self.assertIn('Start Ollama', response.json()['detail'])

    def test_translate_returns_actionable_model_error(self) -> None:
        request = httpx.Request('POST', f'{settings.llm_base_url}/api/chat')
        response = httpx.Response(404, request=request, text='model not found')

        with patch(
            'app.main.complete_text',
            new=AsyncMock(side_effect=httpx.HTTPStatusError('missing model', request=request, response=response)),
        ):
            api_response = self.client.post(
                '/api/translate',
                json={'text': 'hello', 'instructions': 'translate this'},
            )

        self.assertEqual(api_response.status_code, 502)
        self.assertIn('ollama pull', api_response.json()['detail'])


if __name__ == '__main__':
    unittest.main()
