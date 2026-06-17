import { renderCasesWidget } from '../widgets/casesWidget.js';
import { renderCalendarWidget } from '../widgets/calendarWidget.js';
import { renderCalendarKanbanWidget } from '../widgets/calendarKanbanWidget.js';
import { renderCalendarTodayTasksWidget } from '../widgets/calendarTodayTasksWidget.js';

export const allowedWidgetIds = ['cases', 'calendarKanban', 'calendar', 'calendarTodayTasks'];

export const widgetRegistry = {
  cases: {
    title: 'Общий перечень дел',
    icon: '🛡️',
    view: 'cases',
    defaultLayout: { x: 0, y: 0, w: 6, h: 4 },
    render: renderCasesWidget
  },

  calendar: {
    title: 'Календарь',
    icon: '📅',
    view: 'calendar',
    defaultLayout: { x: 6, y: 0, w: 6, h: 5 },
    render: renderCalendarWidget
  },

  calendarKanban: {
    title: 'Ближайшие события',
    icon: '🗂️',
    view: 'calendar',
    defaultLayout: { x: 0, y: 4, w: 8, h: 5 },
    render: renderCalendarKanbanWidget
  },

  calendarTodayTasks: {
    title: 'Задачи на сегодня',
    icon: '✅',
    view: 'calendar',
    defaultLayout: { x: 8, y: 4, w: 4, h: 5 },
    render: renderCalendarTodayTasksWidget
  }
};
