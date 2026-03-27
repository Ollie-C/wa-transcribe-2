<script lang="ts">
  let { active = false }: { active?: boolean } = $props();

  const bars = [
    0.38, 0.56, 0.44, 0.72, 0.48, 0.84, 0.62, 0.76, 0.4, 0.9, 0.58, 0.71, 0.46, 0.82, 0.52, 0.67, 0.43, 0.79
  ];
</script>

<div class="volume-meter" aria-hidden={!active} aria-label={active ? 'Animated recording meter' : undefined}>
  <div class="volume-meter__bars">
    {#each bars as height, index}
      <span
        class:volume-meter__bar--active={active}
        class="volume-meter__bar"
        style={`--meter-height:${height}; --meter-delay:${index * 120}ms;`}
      ></span>
    {/each}
  </div>
</div>
