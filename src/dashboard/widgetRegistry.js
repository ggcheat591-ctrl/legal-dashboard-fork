import { renderCasesStatsWidget, renderCasesTableWidget } from '../widgets/casesWidget.js';
import { renderCalendarWidget } from '../widgets/calendarWidget.js';
import { renderCalendarKanbanWidget } from '../widgets/calendarKanbanWidget.js';
import { renderCalendarTodayTasksWidget } from '../widgets/calendarTodayTasksWidget.js';

export const allowedWidgetIds = [
  'casesStats',
  'casesTable',
  'calendarKanban',
  'calendar',
  'calendarTodayTasks'
];

export const widgetRegistry = {
  casesStats: {
    title: 'Дела: показатели',
    icon: '🛡️',
    view: 'cases',
    defaultLayout: { x: 0, y: 0, w: 4, h: 4 },
    render: renderCasesStatsWidget
  },

  casesTable: {
    title: 'Общий перечень дел',
    icon: '📋',
    view: 'cases',
    defaultLayout: { x: 4, y: 0, w: 8, h: 5 },
    render: renderCasesTableWidget
  },

  calendar: {
    title: 'Календарь',
    icon: '📅',
    view: 'calendar',
    defaultLayout: { x: 0, y: 4, w: 4, h: 5 },
    render: renderCalendarWidget
  },

  calendarKanban: {
    title: 'Ближайшие события',
    icon: '🗂️',
    view: 'calendar',
    defaultLayout: { x: 4, y: 5, w: 8, h: 5 },
    render: renderCalendarKanbanWidget
  },

  calendarTodayTasks: {
    title: 'Задачи на сегодня',
    icon: '✅',
    view: 'calendar',
    defaultLayout: { x: 0, y: 9, w: 4, h: 5 },
    render: renderCalendarTodayTasksWidget
  }
};
