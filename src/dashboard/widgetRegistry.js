import { renderCasesWidget } from '../widgets/casesWidget.js';
import { renderControlledCasesWidget } from '../widgets/controlledCasesWidget.js';
import { renderEnforcementWidget } from '../widgets/enforcementWidget.js';
import { renderCalendarWidget } from '../widgets/calendarWidget.js';
import { renderCalendarKanbanWidget } from '../widgets/calendarKanbanWidget.js';
import { renderCalendarTodayTasksWidget } from '../widgets/calendarTodayTasksWidget.js';
import { renderScheduleWidget } from '../widgets/scheduleWidget.js';
import { renderMapWidget } from '../widgets/mapWidget.js';
import { renderEmergencyFundWidget } from '../widgets/emergencyFundWidget.js';
import { renderMunicipalRegistryWidget } from '../widgets/municipalRegistryWidget.js';
import { renderCriticalAlertsWidget } from '../widgets/criticalAlertsWidget.js';

export const widgetRegistry = {
  criticalAlerts: {
    title: 'Критические ситуации',
    icon: '🔔',
    action: 'notifications',
    defaultLayout: { x: 0, y: 0, w: 12, h: 3 },
    render: renderCriticalAlertsWidget
  },

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
    defaultLayout: { x: 6, y: 0, w: 4, h: 5 },
    render: renderCalendarWidget
  },

  calendarKanban: {
    title: 'План: канбан',
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
  },

  schedule: {
    title: 'График заседаний',
    icon: '🕒',
    view: 'schedule',
    defaultLayout: { x: 6, y: 5, w: 6, h: 4 },
    render: renderScheduleWidget
  },

  controlledCases: {
    title: 'Контрольные дела',
    icon: '📌',
    view: 'controlledCases',
    defaultLayout: { x: 0, y: 4, w: 6, h: 3 },
    render: renderControlledCasesWidget
  },

  enforcement: {
    title: 'Исполнительные производства',
    icon: '⚖️',
    view: 'enforcement',
    defaultLayout: { x: 0, y: 7, w: 6, h: 3 },
    render: renderEnforcementWidget
  },

  map: {
    title: 'Карта',
    icon: '🗺️',
    view: 'map',
    defaultLayout: { x: 6, y: 9, w: 6, h: 3 },
    render: renderMapWidget
  },

  emergencyFund: {
    title: 'Аварийный фонд',
    icon: '📊',
    view: 'emergencyFund',
    defaultLayout: { x: 0, y: 10, w: 6, h: 4 },
    render: renderEmergencyFundWidget
  },

  municipalRegistry: {
    title: 'Реестр муниципальной собственности',
    icon: '🏢',
    view: 'municipalRegistry',
    defaultLayout: { x: 6, y: 10, w: 6, h: 4 },
    render: renderMunicipalRegistryWidget
  }
};
