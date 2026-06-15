export function filterCalendarEvents(events, type) {
  return type ? events.filter(event => event.type === type) : events;
}
