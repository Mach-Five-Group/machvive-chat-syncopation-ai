/**
 * Bulk entry point.
 *
 * Importing this registers every tag. Each module is imported for its side
 * effect *and* its class re-exported, so `import '@…/machvive-chat-syncopation-ai'`
 * is enough to use the tags in HTML, while the classes remain available for
 * subclassing or direct instantiation.
 *
 * Cherry-pick instead (`…-ai/canvas`) when a page only needs one surface — the
 * subpaths in package.json exports exist for exactly that.
 */
import { MachviveChatSyncopationServices } from './src/wc/machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
import { MachviveChatSyncopation } from './src/wc/machvive-chat-syncopation/machvive-chat-syncopation.js';
import { MachviveChatSyncopationCanvas } from './src/wc/machvive-chat-syncopation-canvas/machvive-chat-syncopation-canvas.js';
import { MachviveChatSyncopationPrompt } from './src/wc/machvive-chat-syncopation-prompt/machvive-chat-syncopation-prompt.js';
import { MachviveChatSyncopationNudge } from './src/wc/machvive-chat-syncopation-nudge/machvive-chat-syncopation-nudge.js';
import { MachviveChatSyncopationCli } from './src/wc/machvive-chat-syncopation-cli/machvive-chat-syncopation-cli.js';
import { MachviveChatSyncopationVoice } from './src/wc/machvive-chat-syncopation-voice/machvive-chat-syncopation-voice.js';
import { MachviveChatSyncopationInspector } from './src/wc/machvive-chat-syncopation-inspector/machvive-chat-syncopation-inspector.js';
import { MachviveChatSyncopationHistory } from './src/wc/machvive-chat-syncopation-history/machvive-chat-syncopation-history.js';

export {
  MachviveChatSyncopationServices,
  MachviveChatSyncopation,
  MachviveChatSyncopationCanvas,
  MachviveChatSyncopationPrompt,
  MachviveChatSyncopationNudge,
  MachviveChatSyncopationCli,
  MachviveChatSyncopationVoice,
  MachviveChatSyncopationInspector,
  MachviveChatSyncopationHistory
};

// The service layer, for page code that drives the surface directly.
export {
  PubSub,
  Conversation,
  Daemon,
  transports,
  Cache,
  resolveConfig,
  DEFAULTS,
  Recorder,
  resolveComponentConfig,
  attrToKey,
  keyToAttr,
  renderConfigForm,
  CONFIG_FORM_CSS,
  createRecord,
  ROLES,
  isPending,
  META,
  annotate,
  readMeta,
  userMeta,
  THEME_CSS,
  CONTROL_CSS,
  findServices,
  whenServices,
  SERVICES_TAG
} from './src/wc/machvive-chat-syncopation-services/machvive-chat-syncopation-services.js';
