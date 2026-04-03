/**
 * EventBus stub for the embed SDK.
 * Provides a no-op event system — subsystems that emit events
 * will silently succeed without any listeners.
 */

class EventBusStub {
  emit() {}
  on() {}
  off() {}
  once() {}
}

export const eventBus = new EventBusStub();

export const EVENTS = {
  LEAD_ADDED: 'lead:added',
  LEAD_UPDATED: 'lead:updated',
  LEAD_MOVED: 'lead:moved',
  FORM_SUBMITTED: 'form:submitted',
  FORM_CREATED: 'form:created',
};
