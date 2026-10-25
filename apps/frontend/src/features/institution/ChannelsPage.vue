<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '../../lib/backend'
import { language as l, errorMessage } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import ChannelThread from './ChannelThread.vue'
import type { Member, Institution } from './types'
const route = useRoute(),
  router = useRouter(),
  institution = institutionContext().institution,
  view = institutionContext().view,
  id = computed(() => String(route.params.channel || '')),
  base = '/messages'
type Channel = {
  id: string
  title: string
  unread: number
  last_body: string | null
  archived: boolean
}
type Contact = Pick<Member, 'id' | 'name' | 'roles' | 'active'>
const thread = ref<InstanceType<typeof ChannelThread>>()
async function refresh() {
  await Promise.all([load(), loadPeople(), thread.value?.refresh()])
}
const items = ref<Channel[]>([]),
  groups = ref<{ id: string; name: string }[]>([]),
  people = ref<Contact[]>([]),
  directPeople = ref<string[]>([]),
  institutionSelf = ref<Institution['self']>(),
  search = ref(String(route.query.search || '')),
  next = ref<number | null>(null),
  loading = ref(true),
  peopleLoading = ref(true),
  error = ref(''),
  peopleError = ref(''),
  manage = ref(false)
const contacts = computed(() =>
  people.value
    .filter((person) => person.active && person.id !== institutionSelf.value?.id)
    .filter((person) => !directPeople.value.includes(person.id))
    .filter(
      (person) => !search.value || person.name.toLowerCase().includes(search.value.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name)),
)
async function load(append = false) {
  loading.value = true
  error.value = ''
  try {
    const result = await request<{
      items: Channel[]
      next: number | null
      directPeople: string[]
      groups: { id: string; name: string }[]
    }>(
      `/v1/institution/communication?view=${view}&search=${encodeURIComponent(search.value)}&offset=${append ? next.value || 0 : 0}&manage=${manage.value}`,
    )
    items.value = append ? [...items.value, ...result.items] : result.items
    directPeople.value = result.directPeople
    groups.value = result.groups
    next.value = result.next
  } catch (e) {
    error.value = errorMessage(e)
    items.value = []
  } finally {
    loading.value = false
  }
}
async function loadPeople() {
  peopleLoading.value = true
  peopleError.value = ''
  try {
    const result = await request<Institution>(
      `/v1/institution/communication?view=${view}&contacts=true`,
    )
    institutionSelf.value = result.self
    people.value = result.members
  } catch (e) {
    peopleError.value = errorMessage(e)
    people.value = []
  } finally {
    peopleLoading.value = false
  }
}
const join = useCommand<'join'>(
  `channel-join:${institution}:${view}`,
  async (_, __, args) => {
    await router.push(base + '/' + args.id)
  },
  (_, args) =>
    request(`/v1/institution/communication`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
)
const locked = computed(() => join.state.busy || !!join.state.pending)
const joinConversation = (id: string) =>
  join.run('join', { id, view, action: 'join', operation: crypto.randomUUID() })
const direct = useCommand<'direct'>(
  `channel-direct:${institution}:${view}`,
  async (_, result) => {
    await router.push(base + '/' + (result as { id: string }).id)
  },
  (_, args) =>
    request(`/v1/institution/communication`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  { successToast: false },
)
const openDirect = (person: Contact) =>
  direct.run('direct', {
    id: crypto.randomUUID(),
    title: person.name,
    members: [institutionSelf.value!.id, person.id],
    managers: [view === 'trainee' ? person.id : institutionSelf.value!.id],
    action: 'create',
    view,
    operation: crypto.randomUUID(),
  })
watch(
  [() => route.query.to, () => peopleLoading.value],
  ([target, isLoading]) => {
    if (!target || isLoading) return
    const person = people.value.find((member) => member.id === String(target) && member.active)
    if (person) void openDirect(person)
  },
  { immediate: true },
)
const openGroup = useCommand<'open-group'>(
  `channel-group:${institution}:${view}`,
  async (_, result) => {
    const channel = result as { id: string }
    await router.replace(base + '/' + channel.id)
  },
  (_, args) =>
    request(`/v1/institution/communication`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),
  { successToast: false },
)
const startGroup = (group: string) =>
  openGroup.run('open-group', {
    id: group,
    view,
    action: 'open-group',
    operation: crypto.randomUUID(),
  })
watch(
  [() => route.query.group, () => openGroup.state.ready],
  ([group, ready]) => {
    const groupId = String(group || '')
    if (groupId && ready && !openGroup.state.busy)
      void openGroup.run('open-group', {
        id: groupId,
        view,
        action: 'open-group',
        operation: crypto.randomUUID(),
      })
  },
  { immediate: true },
)
onMounted(() => {
  void load()
  void loadPeople()
})
watch(
  () => route.fullPath,
  () => {
    void load()
  },
)
</script>
<template>
  <div
    class="container page messages-page institution-messages organization-messages"
    :class="{ 'has-thread': !!id }"
  >
    <header class="messages-heading">
      <h1>{{ l('Messages', 'الرسائل') }}</h1>
      <div class="actions">
        <button class="text-link" @click="refresh">{{ l('Refresh', 'تحديث') }}</button>
      </div>
    </header>
    <CommandStatus :command="join" />
    <CommandStatus :command="openGroup" />
    <CommandStatus :command="direct" :show-notice="false" />
    <p v-if="error" role="alert" class="notice error">
      {{ error }}
      <button class="text-link" @click="load()">{{ l('Try again', 'حاول مجدداً') }}</button>
    </p>
    <div class="conversation-layout">
      <aside class="conversation-inbox">
        <form class="conversation-search" @submit.prevent="load()">
          <label
            >{{ l('Search people and conversations', 'ابحث عن الأشخاص والمحادثات')
            }}<input
              :placeholder="l('Search people and conversations…', 'ابحث عن أشخاص ومحادثات…')"
              v-model="search"
              type="search" /></label
          ><button class="text-link">{{ l('Search', 'بحث') }}</button
          ><label v-if="view === 'admin'" class="check-label small-print"
            ><input v-model="manage" type="checkbox" @change="load()" />{{
              l('Discover institution conversations', 'عرض محادثات المؤسسة')
            }}</label
          >
        </form>
        <div class="conversation-directory">
          <details class="conversation-contacts" aria-labelledby="contact-heading">
            <summary id="contact-heading">
              {{ l('Start a conversation', 'ابدأ محادثة') }} ({{ contacts.length + groups.length }})
            </summary>
            <p v-if="peopleLoading" role="status" class="small-print">
              {{ l('Loading people…', 'جارٍ تحميل الأشخاص…') }}
            </p>
            <p v-else-if="peopleError" role="alert" class="notice error">
              {{ peopleError }}
              <button class="text-link" @click="loadPeople">
                {{ l('Try again', 'حاول مجدداً') }}
              </button>
            </p>
            <p
              v-else-if="!contacts.length && !groups.length && !items.length && !search && !loading"
              class="small-print"
            >
              {{
                l('No available people match this search.', 'لا يوجد أشخاص متاحون يطابقون البحث.')
              }}
            </p>
            <button
              v-for="person in contacts"
              :key="person.id"
              type="button"
              class="conversation-person contact-person"
              :disabled="direct.state.busy || !!direct.state.pending"
              @click="openDirect(person)"
            >
              <span class="avatar">{{ person.name.slice(0, 1) }}</span>
              <span class="grow">
                <strong dir="auto">{{ person.name }}</strong>
                <small>{{
                  person.roles
                    .map((role) =>
                      l(
                        role === 'admin'
                          ? 'Administrator'
                          : role === 'trainer'
                            ? 'Coach'
                            : 'Athlete',
                        role === 'admin' ? 'مسؤول' : role === 'trainer' ? 'مدرب' : 'رياضي',
                      ),
                    )
                    .join(' · ')
                }}</small>
                <small>{{ l('Start your conversation', 'ابدأ محادثتك') }}</small>
              </span>
            </button>
            <button
              v-for="group in groups"
              :key="group.id"
              type="button"
              class="conversation-person contact-person"
              :disabled="openGroup.state.busy || !!openGroup.state.pending"
              @click="startGroup(group.id)"
            >
              <span class="avatar">{{ group.name.slice(0, 1) }}</span>
              <span class="grow"
                ><strong dir="auto">{{ group.name }}</strong
                ><small>{{
                  l('Group · Start your conversation', 'مجموعة · ابدأ محادثتك')
                }}</small></span
              >
            </button>
          </details>
          <h2 class="conversation-section-title">{{ l('Conversations', 'المحادثات') }}</h2>
          <p v-if="loading && !items.length" role="status" class="notice">
            {{ l('Loading…', 'جارٍ التحميل…') }}
          </p>
          <nav class="conversation-list" :aria-label="l('Conversations', 'المحادثات')">
            <div v-if="!loading && !items.length" class="conversation-empty notice">
              <p>
                {{
                  search
                    ? l('No matching conversations.', 'لا توجد محادثات مطابقة.')
                    : l('No conversations yet.', 'لا توجد محادثات بعد.')
                }}
              </p>
            </div>
            <template v-for="c in items" :key="c.id"
              ><article v-if="manage" class="conversation-person">
                <div class="grow">
                  <strong dir="auto">{{ c.title }}</strong>
                  <p>
                    {{
                      l(
                        'Join to read the conversation. Your name will be visible to everyone.',
                        'انضم لقراءة المحادثة. سيظهر اسمك للجميع.',
                      )
                    }}
                  </p>
                  <button class="text-link" :disabled="locked" @click="joinConversation(c.id)">
                    {{ l('Join conversation', 'الانضمام للمحادثة') }}
                  </button>
                </div>
              </article>
              <RouterLink
                v-else
                :to="base + '/' + c.id + (search ? '?search=' + encodeURIComponent(search) : '')"
                class="conversation-person"
                :class="{ selected: c.id === id }"
                ><span class="avatar">{{ c.title.slice(0, 1) }}</span>
                <div class="grow">
                  <strong dir="auto">{{ c.title }}</strong>
                  <p>{{ c.last_body || l('No messages yet', 'لا توجد رسائل بعد') }}</p>
                  <small v-if="c.archived">{{ l('Archived', 'مؤرشفة') }}</small>
                </div>
                <span
                  v-if="c.unread"
                  class="count"
                  :aria-label="c.unread + ' ' + l('unread messages', 'رسائل غير مقروءة')"
                  >{{ c.unread }}</span
                ></RouterLink
              ></template
            ><button v-if="next !== null" class="text-link" @click="load(true)">
              {{ l('Load more', 'تحميل المزيد') }}
            </button>
          </nav>
        </div>
      </aside>
      <ChannelThread
        ref="thread"
        :key="id"
        v-if="id"
        :id="id"
        :institution="institution"
        :view="view"
        :base="base"
        @refresh="load()"
      />
      <div v-else class="conversation-placeholder">
        <h2>{{ l('Keep the group in sync', 'ابقَ على تواصل مع المجموعة') }}</h2>
        <p>
          {{
            l(
              'Choose a conversation. Each one has its own visible participant list.',
              'اختر محادثة. لكل محادثة قائمة واضحة بمشاركيها.',
            )
          }}
        </p>
      </div>
    </div>
  </div>
</template>
<style scoped>
.organization-messages {
  min-width: 0;
}
.conversation-contacts {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.5rem;
}
.conversation-section-title {
  margin: 0.85rem 1rem 0.25rem;
  font-size: 0.85rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.contact-person {
  width: 100%;
  color: inherit;
  text-align: start;
  font: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.contact-person:disabled {
  cursor: wait;
  opacity: 0.7;
}
.contact-person:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.contact-person small {
  display: block;
  color: var(--muted);
}
.conversation-search {
  display: grid;
  gap: 8px;
  align-content: start;
  margin: 0;
  flex: none;
}
.conversation-search label {
  margin: 0;
}
.conversation-search button {
  margin: 0;
  justify-self: start;
  min-height: 32px;
}
.messages-heading .actions {
  margin: 0;
}
.messages-heading {
  flex-wrap: wrap;
}
.organization-messages > .conversation-layout {
  min-height: 0;
}
.conversation-placeholder h2 {
  font-size: 1.25rem;
}
</style>

<style>
/* Short viewports may scroll the page; the footer must never cover the inbox. */
</style>
