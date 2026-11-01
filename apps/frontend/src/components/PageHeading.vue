<!-- Shared page heading: presents the view title, task description and optional actions. -->
<template>
  <header class="ui-page-heading"><slot /></header>
</template>
<style scoped>
.ui-page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
  max-width: none;
  margin-block: 0 var(--space-6);
}
.ui-page-heading > :deep(div:first-child) {
  min-width: 0;
}
.ui-page-heading :deep(h1) {
  margin: 0;
  font-size: var(--text-page);
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
}
.ui-page-heading :deep(p:not(.overline)) {
  margin: var(--space-2) 0 0;
  max-width: 72ch;
  color: var(--muted);
  font-size: var(--text-small);
  line-height: 1.65;
}
.ui-page-heading :deep(.actions) {
  margin: 0;
}
.ui-page-heading:dir(rtl) :deep(h1) {
  letter-spacing: normal;
  line-height: 1.5;
}
@media (max-width: 650px) {
  .ui-page-heading {
    align-items: flex-start;
    margin-block-end: var(--space-5);
  }
  .ui-page-heading :deep(h1) {
    font-size: 1.75rem;
  }
}
</style>
