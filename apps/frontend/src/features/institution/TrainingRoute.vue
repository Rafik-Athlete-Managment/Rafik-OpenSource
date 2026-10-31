<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import AthletePlans from './AthletePlans.vue'
import AthleteTraining from './AthleteTraining.vue'
</script>
<template>
  <AthleteTraining v-if="institutionContext().view === 'trainee'" /><AthletePlans v-else />
</template>
