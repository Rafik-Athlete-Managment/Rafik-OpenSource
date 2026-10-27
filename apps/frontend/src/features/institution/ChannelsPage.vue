<script setup lang="ts">
import { institutionContext } from '../../app/institution'

import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { request } from '../../lib/backend'
import { language as l, errorMessage, locale } from '../../lib/i18n'
import { useCommand } from '../../lib/commands'
import CommandStatus from '../../components/CommandStatus.vue'
import ChannelThread from './ChannelThread.vue'
import { useLiveSearch } from '../../lib/live-search'
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
  joined: boolean
  private_pair: boolean
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
  manage = ref(false),
  // Two tabs, as in common chat apps: existing chats, and contacts to start a new one.
  // Older ?tab=people|groups links open Contacts.
  tab = ref<'chats' | 'contacts'>(
    route.query.tab === 'people' || route.query.tab === 'groups' || route.query.tab === 'contacts'
      ? 'contacts'
      : 'chats',
  )
const term = computed(() => search.value.trim().toLocaleLowerCase())
const matches = (text: string) => !term.value || text.toLocaleLowerCase().includes(term.value)
// Everyone you can message. Choosing someone you already talk to reopens that chat.
const contacts = computed(() =>
  people.value
    .filter((person) => person.active && person.id !== institutionSelf.value?.id)
    .filter((person) => matches(person.name))
    .sort((a, b) => a.name.localeCompare(b.name)),
)
// Unfiltered first-page results, so typing can narrow instantly before the server answers.
const baseItems = ref<Channel[]>([]),
  baseGroups = ref<{ id: string; name: string }[]>([])
const unique = <T extends { id: string }>(list: T[]) => [
  ...new Map(list.map((item) => [item.id, item])).values(),
]
const contactGroups = computed(() =>
  unique([...groups.value, ...baseGroups.value]).filter((group) => matches(group.name)),
)
let loadGeneration = 0
// Filter what is already loaded at once; the debounced server search then finds older chats.
const visibleChannels = computed(() =>
  term.value
    ? unique([...items.value, ...baseItems.value]).filter((item) => matches(item.title))
    : items.value,
)
function moveTab(event: KeyboardEvent, current: typeof tab.value, direction: number) {
  const options = ['chats', 'contacts'] as const
  const delta = locale.value === 'ar' ? -direction : direction
  tab.value = options[(options.indexOf(current) + delta + options.length) % options.length]!
  ;(event.currentTarget as HTMLElement).parentElement
    ?.querySelector<HTMLElement>('#message-tab-' + tab.value)
    ?.focus()
}
function toggleInstitution() {
  manage.value = !manage.value
  void load()
}
async function load(append = false) {
  const generation = ++loadGeneration
  loading.value = true
  error.value = ''
  try {
    const result = await request<{
      items: Channel[]
      next: number | null
      directPeople: string[]
      groups: { id: string; name: string }[]
    }>(
      `/v1/institution/communication?view=${view}&search=${encodeURIComponent(search.value.trim())}&offset=${append ? next.value || 0 : 0}&manage=${manage.value}`,
    )
    if (generation !== loadGeneration) return
    if (!search.value.trim() && !append) {
      baseItems.value = result.items
      baseGroups.value = result.groups
    }
    items.value = append ? [...items.value, ...result.items] : result.items
    directPeople.value = result.directPeople
    groups.value = result.groups
    next.value = result.next
  } catch (e) {
    if (generation !== loadGeneration) return
    error.value = errorMessage(e)
    items.value = []
  } finally {
    if (generation === loadGeneration) loading.value = false
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
    tab.value = 'chats'
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
    tab.value = 'chats'
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
const live = useLiveSearch(search, () => load(), 250)
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
        <div
          class="conversation-tabs ui-tabs"
          role="tablist"
          :aria-label="l('Message directory', 'دليل الرسائل')"
        >
          <button
            v-for="option in ['chats', 'contacts'] as const"
            :id="'message-tab-' + option"
            :key="option"
            type="button"
            role="tab"
            :aria-selected="tab === option"
            :tabindex="tab === option ? 0 : -1"
            :data-state="tab === option ? 'active' : 'inactive'"
            aria-controls="message-directory-panel"
            @click="tab = option"
            @keydown.right.prevent="moveTab($event, option, 1)"
            @keydown.left.prevent="moveTab($event, option, -1)"
          >
            {{ option === 'chats' ? l('Chats', 'المحادثات') : l('Contacts', 'جهات الاتصال') }}
          </button>
        </div>
        <form class="conversation-search" role="search" @submit.prevent="live.submit()">
          <label
            ><span class="sr-only">{{
              tab === 'chats'
                ? l('Search chats', 'البحث في المحادثات')
                : l('Search contacts', 'البحث في جهات الاتصال')
            }}</span
            ><input
              :placeholder="
                tab === 'chats'
                  ? l('Search chats…', 'ابحث في المحادثات…')
                  : l('Search people and groups…', 'ابحث عن أشخاص ومجموعات…')
              "
              v-model="search"
              type="search"
          /></label>
          <button
            v-if="view === 'admin' && tab === 'chats'"
            type="button"
            role="switch"
            :aria-checked="manage"
            class="institution-message-switch"
            @click="toggleInstitution"
          >
            <span aria-hidden="true" class="switch-indicator">{{ manage ? '✓' : '' }}</span
            >{{ l('Include institution conversations', 'تضمين محادثات المؤسسة') }}
          </button>
        </form>
        <div class="conversation-directory">
          <div id="message-directory-panel" role="tabpanel" :aria-labelledby="'message-tab-' + tab">
            <div v-show="tab === 'contacts'" class="conversation-contacts">
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
                v-else-if="!contacts.length && !contactGroups.length"
                class="small-print contact-empty"
              >
                {{
                  search
                    ? l(
                        'No people or groups match this search.',
                        'لا يوجد أشخاص أو مجموعات مطابقة.',
                      )
                    : l('No contacts available yet.', 'لا توجد جهات اتصال متاحة بعد.')
                }}
              </p>
              <template v-if="contactGroups.length">
                <h2 class="contact-section">{{ l('Groups', 'المجموعات') }}</h2>
                <button
                  v-for="group in contactGroups"
                  :key="group.id"
                  type="button"
                  class="conversation-person contact-person"
                  :disabled="openGroup.state.busy || !!openGroup.state.pending"
                  @click="startGroup(group.id)"
                >
                  <span class="avatar">{{ group.name.slice(0, 1) }}</span>
                  <span class="grow"
                    ><strong dir="auto">{{ group.name }}</strong
                    ><small>{{ l('Start a group chat', 'ابدأ محادثة جماعية') }}</small></span
                  >
                </button>
              </template>
              <template v-if="contacts.length">
                <h2 class="contact-section">{{ l('People', 'الأشخاص') }}</h2>
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
                    <small
                      >{{
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
                      }}<template v-if="directPeople.includes(person.id)">
                        · {{ l('Open chat', 'فتح المحادثة') }}</template
                      ></small
                    >
                  </span>
                </button>
              </template>
            </div>

            <p v-if="tab === 'chats' && loading && !items.length" role="status" class="notice">
              {{ l('Loading…', 'جارٍ التحميل…') }}
            </p>
            <nav
              v-show="tab === 'chats'"
              class="conversation-list"
              :aria-label="l('Chats', 'المحادثات')"
            >
              <div
                v-if="!loading && !visibleChannels.length"
                class="conversation-empty small-print"
              >
                <p>
                  {{
                    search
                      ? l('No chats match this search.', 'لا توجد محادثات مطابقة.')
                      : l('No chats yet.', 'لا توجد محادثات بعد.')
                  }}
                </p>
                <button type="button" class="text-link" @click="tab = 'contacts'">
                  {{
                    search
                      ? l('Search contacts instead', 'ابحث في جهات الاتصال')
                      : l('Start a chat from Contacts', 'ابدأ محادثة من جهات الاتصال')
                  }}
                </button>
              </div>
              <template v-for="c in visibleChannels" :key="c.id"
                ><article v-if="!c.joined" class="conversation-person">
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
        <h2>{{ l('No conversation open', 'لا توجد محادثة مفتوحة') }}</h2>
        <p>
          {{
            l(
              'Choose a conversation, or start one with someone you work with. Each conversation has its own visible participant list.',
              'اختر محادثة أو ابدأ محادثة مع شخص تعمل معه. لكل محادثة قائمة واضحة بمشاركيها.',
            )
          }}
        </p>
        <button type="button" class="button secondary" @click="tab = 'contacts'">
          {{ l('Start a conversation', 'بدء محادثة') }}
        </button>
      </div>
    </div>
  </div>
</template>
<style scoped>
.contact-section {
  margin: var(--space-3) 0 var(--space-1);
  padding-inline: var(--space-2);
  color: var(--muted);
  font-size: var(--text-caption);
  font-weight: 700;
}
.contact-empty {
  padding: var(--space-3) var(--space-2);
}
.conversation-empty {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
  padding: var(--space-4) var(--space-2);
}
.conversation-empty p {
  margin: 0;
}
.conversation-placeholder .button {
  margin-block-start: var(--space-4);
}
.organization-messages {
  min-width: 0;
}
.institution-message-switch {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--ink);
  background: transparent;
  border: 0;
  text-align: start;
}
.switch-indicator {
  display: inline-grid;
  place-items: center;
  inline-size: 1.2rem;
  block-size: 1.2rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
}
[aria-checked='true'] .switch-indicator {
  background: var(--accent);
  color: var(--on-accent);
}
.conversation-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-1);
  padding: var(--space-2);
}
.conversation-tabs button {
  min-width: 0;
  padding-inline: var(--space-1);
  font-size: var(--text-small);
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
