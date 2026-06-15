import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import * as XLSX from "xlsx";
import "@geoman-io/leaflet-geoman-free";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

const BARNAUL_CENTER = [53.347996, 83.779806];

// Практическая обрезка по bbox Барнаула.
// Это не юридически точная административная граница, а удобный прямоугольник,
// который ограничивает карту и запросы WMS видимой областью города.
const BARNAUL_BOUNDS = [
  [53.22, 83.52],
  [53.48, 84.03]
];

const ALTAI_KRAI_BOUNDS = [
  [50.65, 77.45],
  [54.55, 88.25]
];

const MAP_MAX_BOUNDS = [
  [49.8, 75.8],
  [55.6, 90.1]
];

const MAP_MIN_ZOOM = 6;
const MAP_MAX_ZOOM = 22;

const MAP_VIEW_MODES = {
  barnaul: {
    label: "Барнаул",
    bounds: BARNAUL_BOUNDS,
    fitOptions: { padding: [24, 24], maxZoom: 12 }
  },
  altai: {
    label: "Алтайский край",
    bounds: ALTAI_KRAI_BOUNDS,
    fitOptions: { padding: [24, 24], maxZoom: 7 }
  }
};


const BARNAUL_ADMIN_BOUNDARY_FALLBACK = {
  type: "Feature",
  properties: { name: "Барнаул" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [83.505, 53.365],
      [83.565, 53.447],
      [83.690, 53.482],
      [83.865, 53.475],
      [84.035, 53.438],
      [84.060, 53.355],
      [84.020, 53.275],
      [83.895, 53.225],
      [83.690, 53.205],
      [83.545, 53.245],
      [83.505, 53.365]
    ]]
  }
};


const STORAGE_KEY = "custom-gis-map-v43";
const NSPD_ROOT_GROUP_ID = "nspd_root";
const defaultLayers = [
  { id: "layer_points", name: "Мои точки", color: "#2563eb", visible: false },
  { id: "layer_polygons", name: "Мои полигоны", color: "#dc2626", visible: false }
];

/**
 * Важно:
 * НСПД не публикует стабильный официальный список всех ID слоёв для стороннего использования.
 * Поэтому эти пресеты нужно проверять через DevTools на https://nspd.gov.ru/map:
 * 1) включить слой на НСПД;
 * 2) DevTools -> Network;
 * 3) найти GetMap;
 * 4) взять ID из URL вида /api/aeggis/v3/{ID}/wms.
 *
 * В это приложение можно добавить любой слой вручную через панель "Добавить WMS".
 */
function buildNspdWmsUrl(layerId) {
  const cleanId = String(layerId || "").trim();
  return `/nspd/api/aeggis/v4/${cleanId}/wms`;
}

function makeAreaBoundsKey(areaBounds) {
  if (!areaBounds) return "";
  return [areaBounds.south, areaBounds.west, areaBounds.north, areaBounds.east]
    .map((value) => Number(value).toFixed(6))
    .join(",");
}

function makeLeafletBoundsFromArea(areaBounds) {
  if (!areaBounds) return undefined;
  return L.latLngBounds(
    [Number(areaBounds.south), Number(areaBounds.west)],
    [Number(areaBounds.north), Number(areaBounds.east)]
  );
}

const defaultNspdSubgroups = [
  { id: "egrn", name: "ЕГРН", expanded: false },
  { id: "buildings", name: "Здания и сооружения", expanded: false },
  { id: "zones", name: "ЗОУИТ и зоны", expanded: false },
  { id: "water", name: "Водные объекты", expanded: false },
  { id: "heritage", name: "Культурное наследие", expanded: false },
  { id: "risks", name: "Природные процессы и нарушения", expanded: false },
  { id: "valuation", name: "Кадастровая стоимость", expanded: false },
  { id: "other", name: "Прочее", expanded: false }
];

const defaultNspdGroups = [
  { id: NSPD_ROOT_GROUP_ID, name: "НСПД", expanded: false, parentId: null, type: "category", system: true },
  ...defaultNspdSubgroups.map((group) => ({
    ...group,
    parentId: NSPD_ROOT_GROUP_ID,
    type: "subcategory",
    system: true
  }))
];

const defaultNspdLayers = [
  { id: "cadastral_36048", groupId: "egrn", name: "Земельные участки из ЕГРН", layers: "36048", url: buildNspdWmsUrl("36048"), visible: false, opacity: 0.9, expanded: false },
  { id: "nspd_36328", groupId: "buildings", name: "Сооружения", layers: "36328", url: buildNspdWmsUrl("36328"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_36049", groupId: "buildings", name: "Здания", layers: "36049", url: buildNspdWmsUrl("36049"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_36329", groupId: "buildings", name: "Объекты незавершенного строительства", layers: "36329", url: buildNspdWmsUrl("36329"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_37578", groupId: "zones", name: "ЗОУИТ объектов энергетики, связи, транспорта", layers: "37578", url: buildNspdWmsUrl("37578"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_37581", groupId: "zones", name: "Иные ЗОУИТ", layers: "37581", url: buildNspdWmsUrl("37581"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_37580", groupId: "zones", name: "ЗОУИТ природных территорий", layers: "37580", url: buildNspdWmsUrl("37580"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_37579", groupId: "zones", name: "ЗОУИТ охраняемых объектов и безопасности", layers: "37579", url: buildNspdWmsUrl("37579"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_875838", groupId: "zones", name: "Территориальные зоны", layers: "875838", url: buildNspdWmsUrl("875838"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_879243", groupId: "zones", name: "Красные линии", layers: "879243", url: buildNspdWmsUrl("879243"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_875835", groupId: "water", name: "Береговые линии (границы водных объектов)(линейный)", layers: "875835", url: buildNspdWmsUrl("875835"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_875832", groupId: "water", name: "Береговые линии (границы водных объектов) (полигональный)", layers: "875832", url: buildNspdWmsUrl("875832"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_875840", groupId: "heritage", name: "Территории объектов культурного наследия (РФ)", layers: "875840", url: buildNspdWmsUrl("875840"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_872153", groupId: "risks", name: "Водная эрозия", layers: "872153", url: buildNspdWmsUrl("872153"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_872221", groupId: "risks", name: "Нарушенные земли при складировании и захоронении промышленных отходов, загрязнение земель", layers: "872221", url: buildNspdWmsUrl("872221"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_872219", groupId: "risks", name: "Нарушенные земли при сельскохозяйственном освоении", layers: "872219", url: buildNspdWmsUrl("872219"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_872217", groupId: "risks", name: "Нарушенные земли при недропользовании", layers: "872217", url: buildNspdWmsUrl("872217"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_872213", groupId: "risks", name: "Нарушенные земли при наземном строительстве", layers: "872213", url: buildNspdWmsUrl("872213"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_872210", groupId: "risks", name: "Обвально-осыпные и оползневые процессы", layers: "872210", url: buildNspdWmsUrl("872210"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_872205", groupId: "risks", name: "Затопление", layers: "872205", url: buildNspdWmsUrl("872205"), visible: false, opacity: 0.75, expanded: false },
  { id: "nspd_37236", groupId: "valuation", name: "Кадастровая стоимость объектов", layers: "37236", url: buildNspdWmsUrl("37236"), visible: false, opacity: 0.75, expanded: false }
];

const envNspdUrl = import.meta.env.VITE_NSPD_WMS_URL || "";
const envNspdLayers = import.meta.env.VITE_NSPD_WMS_LAYERS || "";
const envNspdAttribution = import.meta.env.VITE_NSPD_ATTRIBUTION || "НСПД";

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const AUTO_LAYER_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#f97316",
  "#0891b2", "#be123c", "#4f46e5", "#65a30d", "#ca8a04"
];

function autoLayerColor(index = 0) {
  return AUTO_LAYER_COLORS[Math.abs(index) % AUTO_LAYER_COLORS.length];
}

function getNspdLegendColor(layer, index = 0) {
  const value = String(layer?.layers || layer?.id || index);
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  const palette = ["#d946ef", "#2563eb", "#16a34a", "#f97316", "#ef4444", "#0ea5e9", "#8b5cf6", "#84cc16"];
  return palette[hash % palette.length];
}

function fillSwatch(background, border = "rgba(17, 24, 39, 0.2)") {
  return { background, border: `1px solid ${border}` };
}

function outlineSwatch(border, background = "rgba(255,255,255,0.12)") {
  return { background, border: `2px solid ${border}` };
}

function lineSwatch(color, dashed = false, width = 3) {
  return {
    background: "transparent",
    border: 0,
    borderTop: `${width}px ${dashed ? "dashed" : "solid"} ${color}`,
    borderRadius: 0,
    height: 0,
    marginTop: 10
  };
}

const NSPD_LEGENDS = {
  "36048": [
    {
      title: "Росреестр: Земельные участки ЕГРН",
      items: [
        { label: "Земли сельскохозяйственного назначения", swatch: fillSwatch("#f7efb0", "#d2c557") },
        { label: "Земли населённых пунктов", swatch: fillSwatch("#f6d7cf", "#f26a4f") },
        { label: "Земли промышленности и иного специального назначения", swatch: fillSwatch("#ded0b6", "#9b7d3b") },
        { label: "Земли особо охраняемых территорий и объектов", swatch: fillSwatch("#adc69a", "#6d8e4d") },
        { label: "Земли лесного фонда", swatch: fillSwatch("#bae7b8", "#45b95e") },
        { label: "Земли водного фонда", swatch: fillSwatch("#bdd3f6", "#5b8dff") },
        { label: "Земли запаса", swatch: fillSwatch("#efd1ef", "#d84ad1") },
        { label: "Категория не установлена", swatch: fillSwatch("#d4d4d4", "#9ca3af") }
      ]
    }
  ],
  "36328": [
    {
      title: "Росреестр: Сооружения ЕГРН",
      items: [
        { label: "Сооружения", swatch: fillSwatch("#f1a6de", "#d968bd") }
      ]
    }
  ],
  "36049": [
    {
      title: "Росреестр: Здания ЕГРН",
      items: [
        { label: "Здания", swatch: fillSwatch("#d993ef", "#9f59c0") }
      ]
    }
  ],
  "36329": [
    {
      title: "Росреестр: Объекты незавершённого строительства ЕГРН",
      items: [
        { label: "Объекты незавершённого строительства", swatch: fillSwatch("#cfb2e8", "#8e71b8") }
      ]
    }
  ],
  "37578": [
    {
      title: "ЗОУИТ объектов энергетики, связи, транспорта",
      items: [
        { label: "Охранная зона геодезического пункта", swatch: fillSwatch("#ffe4ad", "#eaa31a") },
        { label: "Охранная зона стационарного пункта наблюдений за состоянием окружающей природной среды", swatch: fillSwatch("#caecc0", "#6ebd54") },
        { label: "Охранная зона транспорта", swatch: fillSwatch("#f7d6d6", "#ef4444") },
        { label: "Охранная зона инженерных коммуникаций", swatch: fillSwatch("#cad5f0", "#3f63ff") },
        { label: "Охранная зона линий и сооружений связи и линий и сооружений радиофикации", swatch: fillSwatch("#f9d7bf", "#f97316") },
        { label: "Придорожная полоса", swatch: fillSwatch("#d6d1ce", "#9b948f") },
        { label: "Зоны защиты населения", swatch: fillSwatch("#dcdcf5", "#a2a2df") },
        { label: "Зона ограничения от передающего радиотехнического объекта", swatch: fillSwatch("#efe4a5", "#d2bf28") }
      ]
    }
  ],
  "37581": [
    {
      title: "Иные ЗОУИТ",
      items: [
        { label: "Особо ценные земли", swatch: fillSwatch("#efddff", "#a855f7") },
        { label: "Загрязнённые земли", swatch: fillSwatch("#d8c9c9", "#aa7a7a") },
        { label: "Охранная зона загрязнённых земель", swatch: fillSwatch("#f7d3d3", "#ef4444") },
        { label: "Горный отвод", swatch: fillSwatch("#ddbdd0", "#b83280") },
        { label: "Зелёная зона", swatch: fillSwatch("#bce6b7", "#22c55e") },
        { label: "Территория традиционного природопользования", swatch: fillSwatch("#c7e0cb", "#66a66f") },
        { label: "Зоны с особыми условиями использования территории", swatch: fillSwatch("#d9d9f7", "#6366f1") },
        { label: "Охранная зона", swatch: fillSwatch("#ffe0bc", "#f59e0b") },
        { label: "Район падения отделяющихся частей ракет", swatch: fillSwatch("#f7d1d1", "#ef4444") },
        { label: "Прочие зоны с особыми условиями использования территории", swatch: fillSwatch("#d2ecfb", "#4dabf7") },
        { label: "Зона публичного сервитута", swatch: fillSwatch("#edd6ff", "#a855f7") },
        { label: "Зона резервирования земель", swatch: fillSwatch("#d6e0d0", "#8ca08a") },
        { label: "Особая экономическая зона", swatch: fillSwatch("#f6f4b9", "#d6d325") },
        { label: "Иные зоны с особыми условиями использования территории", swatch: fillSwatch("#d2ecfb", "#38bdf8") },
        { label: "Иная зона с особыми условиями использования территории", swatch: fillSwatch("#d2ecfb", "#38bdf8") },
        { label: "Иная зона", swatch: fillSwatch("#d2ecfb", "#38bdf8") }
      ]
    }
  ],
  "37580": [
    {
      title: "ЗОУИТ природных территорий",
      items: [
        { label: "Зоны охраны природных объектов", swatch: fillSwatch("#cbdfcb", "#7ca87c") },
        { label: "Водоохранная зона", swatch: fillSwatch("#d1ecf8", "#60a5fa") },
        { label: "Прибрежная защитная полоса", swatch: fillSwatch("#f3ddba", "#eaa52a") },
        { label: "Зона санитарной охраны источников водоснабжения и водопроводов питьевого назначения", swatch: fillSwatch("#d5dfff", "#4f6cff") },
        { label: "Территория особо охраняемого природного объекта", swatch: fillSwatch("#c7e5c0", "#59b96a") },
        { label: "Охранная зона особо охраняемого природного объекта", swatch: fillSwatch("#c7e5c0", "#7dd37c") }
      ]
    }
  ],
  "37579": [
    {
      title: "ЗОУИТ охраняемых объектов и безопасности",
      items: [
        { label: "Зоны охраны искусственных объектов", swatch: fillSwatch("#d4d4d4", "#9ca3af") },
        { label: "Запретная зона при военном складе", swatch: fillSwatch("#f9d0d0", "#ef4444") },
        { label: "Запретный район при военном складе", swatch: fillSwatch("#f8d7d7", "#f87171") },
        { label: "Санитарно-защитная зона предприятий, сооружений и иных объектов", swatch: { background: "#e7f0ff", border: "2px dashed #ef4444" } },
        { label: "Санитарный разрыв (санитарная полоса отчуждения)", swatch: fillSwatch("#b8c7e3", "#355ea8") },
        { label: "Пригородная зона", swatch: fillSwatch("#ffd9ad", "#f59e0b") },
        { label: "Пограничная зона", swatch: fillSwatch("#edf29f", "#cddc39") }
      ]
    }
  ],
  "875838": [
    {
      title: "Территориальные зоны",
      items: [
        { label: "Территориальные зоны", swatch: fillSwatch("#d8d4f8", "#8b5cf6") }
      ]
    }
  ],
  "879243": [
    {
      title: "Красные линии",
      items: [
        { label: "Красные линии", swatch: lineSwatch("#ef4444") }
      ]
    }
  ],
  "875835": [
    {
      title: "Береговые линии (границы водных объектов) (линейный)",
      items: [
        { label: "Береговые линии (границы водных объектов) (линейный)", swatch: lineSwatch("#2c69b7") }
      ]
    }
  ],
  "875832": [
    {
      title: "Береговые линии (границы водных объектов) (полигональный)",
      items: [
        { label: "Береговые линии (границы водных объектов) (полигональный)", swatch: outlineSwatch("#2c69b7", "#d8e6fb") }
      ]
    }
  ],
  "875840": [
    {
      title: "Территории объекта культурного наследия",
      items: [
        { label: "Территории объекта культурного наследия", swatch: fillSwatch("#d4dee2", "#5b89a7") }
      ]
    },
    {
      title: "ЗОУИТ объектов культурного наследия",
      items: [
        { label: "Территория объекта культурного наследия", swatch: fillSwatch("#d0ebcc", "#72c66f") },
        { label: "Зона охраняемого природного ландшафта", swatch: fillSwatch("#e6d8cc", "#b78f69") },
        { label: "Зона охраны объекта культурного наследия", swatch: fillSwatch("#d8e5f7", "#6aa0ff") },
        { label: "Зона регулирования застройки и хозяйственной деятельности", swatch: fillSwatch("#d7d3d1", "#908a86") }
      ]
    }
  ],
  "872153": [
    {
      title: "Водная эрозия",
      items: [
        { label: "I Водная эрозия / слабая", swatch: fillSwatch("#efe2d5", "#1f1f1f") },
        { label: "II Водная эрозия / средняя", swatch: fillSwatch("#edcfab", "#1f1f1f") },
        { label: "III Водная эрозия / сильная", swatch: fillSwatch("#e7be98", "#1f1f1f") }
      ]
    }
  ],
  "872221": [
    {
      title: "Нарушенные земли при складировании и захоронении промышленных отходов, загрязнение земель",
      items: [
        { label: "XXXXIX Нарушенные земли при складировании и захоронении промышленных отходов, загрязнение земель", swatch: fillSwatch("#b698c8", "#7c3aed") }
      ]
    }
  ],
  "872219": [
    {
      title: "Нарушенные земли при сельскохозяйственном освоении",
      items: [
        { label: "XXXXVII Нарушенные земли при сельскохозяйственном освоении", swatch: fillSwatch("#c293df", "#7c3aed") }
      ]
    }
  ],
  "872217": [
    {
      title: "Нарушенные земли при недропользовании",
      items: [
        { label: "XXXXV Нарушенные земли при недропользовании", swatch: fillSwatch("#c9a2e0", "#7c3aed") }
      ]
    }
  ],
  "872213": [
    {
      title: "Нарушенные земли при наземном строительстве",
      items: [
        { label: "XXXXIII Нарушенные земли при наземном строительстве", swatch: fillSwatch("#d5c0e8", "#5b324e") }
      ]
    }
  ],
  "872210": [
    {
      title: "Обвально-осыпные и оползневые процессы",
      items: [
        { label: "XXXVI Обвально-осыпные и оползневые процессы / слабые", swatch: fillSwatch("#eee6dc", "#1f1f1f") },
        { label: "XXXVII Обвально-осыпные и оползневые процессы / средние", swatch: fillSwatch("#deccb7", "#1f1f1f") },
        { label: "XXXVIII Обвально-осыпные и оползневые процессы / сильные", swatch: fillSwatch("#d1beaa", "#1f1f1f") }
      ]
    }
  ],
  "872205": [
    {
      title: "Затопление",
      items: [
        { label: "XX Затопление / слабое", swatch: fillSwatch("#d9e7d8", "#1f1f1f") },
        { label: "XXI Затопление / среднее", swatch: fillSwatch("#bfd7c1", "#1f1f1f") },
        { label: "XXII Затопление / сильное", swatch: fillSwatch("#abc6b2", "#1f1f1f") }
      ]
    }
  ],
  "37236": [
    {
      title: "Росреестр: Земельные участки ЕГРН. Кадастровая стоимость. Тепловая карта",
      items: [
        { label: "до 3 млн. руб.", swatch: fillSwatch("#f0f58d", "#d5df1d") },
        { label: "3 млн. руб. – 15 млн. руб.", swatch: fillSwatch("#f4dea2", "#d4a514") },
        { label: "15 млн. руб. – 30 млн. руб.", swatch: fillSwatch("#f8d1aa", "#fb923c") },
        { label: "30 млн. руб. – 100 млн. руб.", swatch: fillSwatch("#f9c6a5", "#f97316") },
        { label: "свыше 100 млн. руб.", swatch: fillSwatch("#f9d0d0", "#ef4444") }
      ]
    }
  ]
};

function buildLegendSectionsForLayer(layer, index = 0) {
  const layerId = String(layer?.layers || "");
  const sections = NSPD_LEGENDS[layerId];
  if (sections?.length) {
    return sections.map((section, sectionIndex) => ({
      ...section,
      id: `${layer.id || layerId}_${sectionIndex}`,
      layerId,
      layerName: layer.name || `НСПД слой ${layerId}`
    }));
  }

  return [{
    id: `${layer.id || layerId}_fallback`,
    title: layer.name || `НСПД слой ${layerId}`,
    layerId,
    layerName: layer.name || `НСПД слой ${layerId}`,
    items: [{ label: layer.name || `Слой ${layerId}`, swatch: fillSwatch(getNspdLegendColor(layer, index)) }]
  }];
}

function normalizeNspdWmsUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  // Уже локальный прокси-путь — оставляем как есть.
  if (value.startsWith("/fg/") || value.startsWith("/nspd/")) {
    return value;
  }

  try {
    const parsed = new URL(value);

    // НСПД запрашиваем только через локальный Flask-прокси, иначе браузер получает 403.
    if (parsed.hostname === "nspd.gov.ru") {
      return `/nspd${parsed.pathname}${parsed.search}`;
    }

    if (parsed.hostname === "fg.avto-spory.ru") {
      return `/fg${parsed.pathname}${parsed.search}`;
    }

    return value;
  } catch {
    return value;
  }
}

function nspdKey(layer) {
  return `${String(layer.url || "").trim()}::${String(layer.layers || "").trim()}`;
}

function guessNspdGroupId(layer) {
  const id = String(layer?.layers || "");
  if (["36048"].includes(id)) return "egrn";
  if (["36049", "36328", "36329"].includes(id)) return "buildings";
  if (["37578", "37579", "37580", "37581", "875838", "879243"].includes(id)) return "zones";
  if (["875835", "875832"].includes(id)) return "water";
  if (["875840"].includes(id)) return "heritage";
  if (["872153", "872221", "872219", "872217", "872213", "872210", "872205"].includes(id)) return "risks";
  if (["37236"].includes(id)) return "valuation";
  return "other";
}

function normalizeNspdGroups(list, layers = []) {
  const groups = Array.isArray(list) && list.length ? list : defaultNspdGroups;
  const normalized = groups.map((group) => ({
    id: group.id || uid("nspd_group"),
    name: group.name || "Раздел",
    expanded: Boolean(group.expanded)
  }));

  const known = new Set(normalized.map((group) => group.id));
  layers.forEach((layer) => {
    const groupId = layer.groupId || "other";
    if (!known.has(groupId)) {
      normalized.push({ id: groupId, name: "Раздел", expanded: true });
      known.add(groupId);
    }
  });

  if (!known.has("other")) normalized.push({ id: "other", name: "Прочее", expanded: false });
  return normalized;
}

function normalizeGroupName(name) {
  return String(name || "").trim().toLocaleLowerCase("ru-RU");
}

function isNspdSubcategory(group) {
  return group?.type === "subcategory" && Boolean(group.parentId);
}

function getNspdSubcategories(groups) {
  return (groups || []).filter(isNspdSubcategory);
}

function getDefaultNspdSubcategoryId(groups = defaultNspdGroups) {
  return getNspdSubcategories(groups)[0]?.id || "other";
}

function getNspdGroupLabel(group, groups) {
  if (!group) return "";
  if (group.parentId) {
    const parent = groups.find((item) => item.id === group.parentId);
    return parent ? `${parent.name} / ${group.name}` : group.name;
  }
  return group.name;
}

function hasDuplicateNspdGroupName(groups, parentId, name, excludeId = "") {
  const normalized = normalizeGroupName(name);
  if (!normalized) return false;
  return groups.some((group) => {
    const sameParent = parentId === null ? !group.parentId : group.parentId === parentId;
    return sameParent && group.id !== excludeId && normalizeGroupName(group.name) === normalized;
  });
}

function normalizeNspdGroupsTree(list, layers = []) {
  const input = Array.isArray(list) && list.length ? list : defaultNspdGroups;
  const hasTree = input.some((group) => group.parentId || group.type === "category" || group.type === "subcategory");
  const normalized = [];
  const known = new Set();

  const pushGroup = (group, fallbackParentId = NSPD_ROOT_GROUP_ID) => {
    const id = group.id || uid("nspd_group");
    if (known.has(id)) return;
    const parentId = group.parentId === null ? null : group.parentId || fallbackParentId;
    const type = parentId ? "subcategory" : "category";
    normalized.push({
      id,
      name: String(group.name || (type === "category" ? "Категория" : "Раздел")).trim() || (type === "category" ? "Категория" : "Раздел"),
      expanded: Boolean(group.expanded),
      parentId,
      type,
      system: Boolean(group.system || id === NSPD_ROOT_GROUP_ID || defaultNspdGroups.some((item) => item.id === id && item.system))
    });
    known.add(id);
  };

  pushGroup({ id: NSPD_ROOT_GROUP_ID, name: "НСПД", expanded: false, parentId: null, type: "category", system: true }, null);

  input.forEach((group) => {
    if (group.id === NSPD_ROOT_GROUP_ID) return;
    pushGroup(group, hasTree ? (group.parentId ?? null) : NSPD_ROOT_GROUP_ID);
  });

  defaultNspdGroups.forEach((group) => {
    if (!known.has(group.id)) pushGroup(group, group.parentId ?? NSPD_ROOT_GROUP_ID);
  });

  layers.forEach((layer) => {
    const groupId = layer.groupId || "other";
    if (!known.has(groupId)) pushGroup({ id: groupId, name: "Раздел", expanded: false }, NSPD_ROOT_GROUP_ID);
  });

  if (!known.has("other")) pushGroup({ id: "other", name: "Прочее", expanded: false, system: true }, NSPD_ROOT_GROUP_ID);
  return normalized;
}

function dedupeNspdLayers(list) {
  const seen = new Set();

  return (list || [])
    .filter((layer) => layer && typeof layer === "object")
    .filter((layer) => {
      const key = nspdKey(layer);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((layer) => ({
      ...layer,
      id: layer.id || uid("nspd"),
      visible: Boolean(layer.visible),
      opacity: Number(layer.opacity ?? 0.85),
      expanded: Boolean(layer.expanded),
      groupId: layer.groupId || guessNspdGroupId(layer)
    }));
}

function collapseNspdGroups(groups) {
  return normalizeNspdGroupsTree(groups).map((group) => ({ ...group, expanded: false }));
}

function turnOffNspdLayers(list) {
  return dedupeNspdLayers(list).map((layer) => ({
    ...layer,
    visible: false,
    expanded: false
  }));
}

function turnOffUserLayers(list) {
  const source = Array.isArray(list) && list.length ? list : defaultLayers;
  return source.map((layer) => ({ ...layer, visible: false }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const envLayer =
        envNspdUrl && envNspdLayers
          ? [
              {
                id: "nspd_env",
                name: "НСПД: слой из .env",
                url: envNspdUrl,
                layers: envNspdLayers,
                visible: false,
                opacity: 0.75,
                groupId: "other",
                expanded: false
              }
            ]
          : [];

      return {
        layers: turnOffUserLayers(defaultLayers),
        features: [],
        nspdLayers: turnOffNspdLayers([...envLayer, ...defaultNspdLayers]),
        nspdGroups: collapseNspdGroups(defaultNspdGroups)
      };
    }

    const parsed = JSON.parse(raw);

    return {
      layers: turnOffUserLayers(parsed.layers?.length ? parsed.layers : defaultLayers),
      features: Array.isArray(parsed.features) ? parsed.features : [],
      nspdLayers: turnOffNspdLayers(parsed.nspdLayers?.length ? parsed.nspdLayers : defaultNspdLayers),
      nspdGroups: collapseNspdGroups(normalizeNspdGroupsTree(parsed.nspdGroups, parsed.nspdLayers?.length ? parsed.nspdLayers : defaultNspdLayers))
    };
  } catch {
    return {
      layers: turnOffUserLayers(defaultLayers),
      features: [],
      nspdLayers: turnOffNspdLayers(defaultNspdLayers),
      nspdGroups: collapseNspdGroups(defaultNspdGroups)
    };
  }
}



function isCadastralFgLayer(item) {
  const url = String(item?.url || "");
  const layers = String(item?.layers || "");
  return (
    url.includes("/fg/apiborder.php") ||
    url.includes("fg.avto-spory.ru/apiborder.php") ||
    ((url.includes("nspd.gov.ru/api/aeggis/v4/36048/wms") || url.includes("/nspd/api/aeggis/v4/36048/wms")) && layers === "36048")
  );
}

function createCadastralTileLayer(item) {
  const layerId = String(item.layers || "36048");
  const baseUrl = normalizeNspdWmsUrl(
    item.url || "/fg/apiborder.php?point=/api/aeggis/v3/36048/wms"
  );

  const CustomCadastralLayer = L.TileLayer.extend({
    getTileUrl(coords) {
      const tileSize = this.getTileSize();
      const nwPoint = coords.scaleBy(tileSize);
      const sePoint = nwPoint.add(tileSize);

      const nw = L.CRS.EPSG3857.pointToLatLng(nwPoint, coords.z);
      const se = L.CRS.EPSG3857.pointToLatLng(sePoint, coords.z);

      const nwProjected = L.CRS.EPSG3857.project(nw);
      const seProjected = L.CRS.EPSG3857.project(se);

      const minX = nwProjected.x;
      const minY = seProjected.y;
      const maxX = seProjected.x;
      const maxY = nwProjected.y;
      const joiner = baseUrl.includes("?") ? "&" : "?";

      return (
        `${baseUrl}${joiner}` +
        `REQUEST=GetMap` +
        `&SERVICE=WMS` +
        `&VERSION=1.3.0` +
        `&FORMAT=image/png` +
        `&STYLES=` +
        `&TRANSPARENT=true` +
        `&LAYERS=${encodeURIComponent(layerId)}` +
        `&RANDOM=${Math.random()}` +
        `&WIDTH=512` +
        `&HEIGHT=512` +
        `&CRS=EPSG:3857` +
        `&BBOX=${minX},${minY},${maxX},${maxY}`
      );
    }
  });

  return new CustomCadastralLayer("", {
    tileSize: 512,
    minZoom: 15,
    maxZoom: 22,
    opacity: item.opacity ?? 0.9,
    attribution: "Кадастровые границы"
  });
}



function featureToLeaflet(feature, color) {
  return L.geoJSON(feature, {
    style: {
      color,
      weight: 3,
      fillOpacity: 0.15
    },
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 7,
        color,
        weight: 2,
        fillOpacity: 0.8
      })
  });
}

function popupHtml(feature) {
  const props = feature.properties || {};
  return `
    <div class="popup">
      <b>${props.name || "Объект"}</b><br/>
      <span>Слой: ${props.layerName || "Без слоя"}</span><br/>
      ${props.objectDescription || props.description ? `<p><b>Описание:</b><br/>${props.objectDescription || props.description}</p>` : ""}
      ${props.info ? `<p><b>Информация:</b><br/>${props.info}</p>` : ""}
    </div>
  `;
}

export default function App() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const userLayerGroupsRef = useRef({});
  const nspdLayerGroupsRef = useRef({});

  // Эти ref нужны, потому что обработчик pm:create регистрируется один раз.
  // Без них он "запоминает" первый активный слой и складывает все новые объекты туда.
  const activeLayerIdRef = useRef("");
  const layersRef = useRef([]);

  const selectedAreaRef = useRef(null);
  const coordinateMarkerRef = useRef(null);
  const addressMarkerRef = useRef(null);
  const areaSelectionModeRef = useRef(false);

  const initial = useMemo(() => loadState(), []);
  const [layers, setLayers] = useState(initial.layers);
  const [features, setFeatures] = useState(initial.features);
  const [nspdLayers, setNspdLayers] = useState(initial.nspdLayers);
  const [nspdGroups, setNspdGroups] = useState(initial.nspdGroups || defaultNspdGroups);
  const [newNspdGroupId, setNewNspdGroupId] = useState(getDefaultNspdSubcategoryId(initial.nspdGroups || defaultNspdGroups));
  const nspdLayersRef = useRef(initial.nspdLayers);
  const [legendOpen, setLegendOpen] = useState(false);
  const [nspdInfo, setNspdInfo] = useState({
    open: false,
    loading: false,
    title: "Данные по объекту",
    rows: [],
    message: "Кликните по объекту на карте, затем выберите слой для просмотра данных.",
    choices: [],
    selectedLayerId: ""
  });

  const [activeLayerId, setActiveLayerId] = useState(initial.layers[0]?.id || "layer_points");
  const [newWmsName, setNewWmsName] = useState("");
  const [newWmsUrl, setNewWmsUrl] = useState("");
  const [newWmsLayers, setNewWmsLayers] = useState("");

  const [selectedAreaBounds, setSelectedAreaBounds] = useState(null);
  const [areaLayerIds, setAreaLayerIds] = useState([]);
  const [coordinateInput, setCoordinateInput] = useState("");
  const [ciasExportLayerIds, setCiasExportLayerIds] = useState(initial.layers.map((layer) => layer.id));
  const [techPanelOpen, setTechPanelOpen] = useState(false);
  const [draggedNspdGroupId, setDraggedNspdGroupId] = useState("");
  const [draggedNspdLayerId, setDraggedNspdLayerId] = useState("");
  const [draggedUserLayerId, setDraggedUserLayerId] = useState("");

  useEffect(() => {
    nspdLayersRef.current = nspdLayers;
  }, [nspdLayers, nspdGroups]);
  const [floatingToolOpen, setFloatingToolOpen] = useState(null);
  const [addressSearchInput, setAddressSearchInput] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSearchOpen, setAddressSearchOpen] = useState(false);
  const [redCadastralNumbers, setRedCadastralNumbers] = useState("22:63:000000:1392\n22:63:040419:37");
  const [redCadastralStatus, setRedCadastralStatus] = useState("");
  const [redCadastralLoading, setRedCadastralLoading] = useState(false);
  const [redClickModeEnabled, setRedClickModeEnabled] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(12);
  const [overviewMode, setOverviewMode] = useState("barnaul");

  const [barnaulClipEnabled, setBarnaulClipEnabled] = useState(true);
  const [adminBoundaryEnabled, setAdminBoundaryEnabled] = useState(true);
  const [adminBoundaryLoading, setAdminBoundaryLoading] = useState(false);
  const [adminBoundaryError, setAdminBoundaryError] = useState("");
  const barnaulBoundaryRef = useRef(null);
  const adminBoundaryLayerRef = useRef(null);
  const redCadastralLayerRef = useRef(null);
  const redClickModeRef = useRef(false);
  const lastNspdClickLatLngRef = useRef(null);

  if (!activeLayerIdRef.current) activeLayerIdRef.current = activeLayerId;
  if (!layersRef.current.length) layersRef.current = layers;

  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];
  const nspdSubcategories = useMemo(() => getNspdSubcategories(nspdGroups), [nspdGroups]);

  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  useEffect(() => {
    layersRef.current = layers;
    setCiasExportLayerIds((prev) => {
      const existingIds = layers.map((layer) => layer.id);
      const kept = prev.filter((id) => existingIds.includes(id));
      return kept.length ? kept : existingIds;
    });
  }, [layers]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("state");
    if (!encoded) return;

    try {
      const decoded = JSON.parse(decodeURIComponent(atob(encoded)));
      if (Array.isArray(decoded.nspdLayers)) {
        setNspdLayers(decoded.nspdLayers);
      }
      if (decoded.center && typeof decoded.zoom === "number" && mapRef.current) {
        mapRef.current.setView(decoded.center, decoded.zoom);
      }
    } catch {
      console.warn("Не удалось прочитать состояние карты из ссылки");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ layers, features, nspdLayers, nspdGroups }));
  }, [layers, features, nspdLayers, nspdGroups]);

  useEffect(() => {
    redClickModeRef.current = redClickModeEnabled;
  }, [redClickModeEnabled]);

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(mapEl.current, {
      center: BARNAUL_CENTER,
      zoom: 12,
      zoomControl: true,
      maxBounds: MAP_MAX_BOUNDS,
      maxBoundsViscosity: 0.85,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      attributionControl: false
    });

    mapRef.current = map;
    setCurrentZoom(map.getZoom());

    map.on("zoomend", () => {
      setCurrentZoom(map.getZoom());
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: MAP_MAX_ZOOM,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.fitBounds(BARNAUL_BOUNDS, MAP_VIEW_MODES.barnaul.fitOptions);

    // Прямоугольный bbox используется только как невидимое ограничение перемещения.
    // Видимую административную границу Барнаула загружаем отдельным GeoJSON-слоем.
    barnaulBoundaryRef.current = null;

    map.pm.addControls({
      position: "topleft",
      drawCircle: false,
      drawCircleMarker: false,
      drawText: false,
      drawMarker: true,
      drawPolyline: true,
      drawRectangle: true,
      drawPolygon: true,
      editMode: true,
      dragMode: true,
      removalMode: true,
      cutPolygon: false,
      rotateMode: false
    });

    map.pm.setLang(
      "ru",
      {
        buttonTitles: {
          drawMarkerButton: "Поставить точку",
          drawPolyButton: "Нарисовать полигон",
          drawLineButton: "Нарисовать линию",
          drawRectButton: "Нарисовать прямоугольник",
          editButton: "Редактировать объекты",
          dragButton: "Переместить объекты",
          deleteButton: "Удалить объекты"
        },
        actions: {
          finish: "Завершить",
          cancel: "Отмена",
          removeLastVertex: "Удалить последнюю точку",
          clear: "Очистить"
        },
        tooltips: {
          placeMarker: "Нажмите на карту, чтобы поставить точку",
          firstVertex: "Нажмите, чтобы поставить первую точку",
          continueLine: "Нажмите, чтобы добавить точку",
          finishLine: "Нажмите на последнюю точку, чтобы завершить линию",
          finishPoly: "Нажмите на первую точку, чтобы завершить полигон",
          finishRect: "Нажмите, чтобы завершить прямоугольник"
        }
      },
      "en"
    );

    map.on("pm:create", (e) => {
      if (areaSelectionModeRef.current) {
        return;
      }

      const currentLayers = layersRef.current;
      const layerId = activeLayerIdRef.current || currentLayers[0]?.id;
      const layerInfo = currentLayers.find((l) => l.id === layerId) || currentLayers[0];

      const name =
        window.prompt("Наименование объекта:", "Новый объект") ||
        "Новый объект";
      const objectDescription = window.prompt("Описание:", "") || "";
      const info = window.prompt("Информация:", "") || "";

      const feature = e.layer.toGeoJSON();
      feature.id = uid("feature");
      feature.properties = {
        ...feature.properties,
        name,
        objectDescription,
        description: objectDescription,
        info,
        layerId,
        layerName: layerInfo?.name || "Слой",
        color: layerInfo?.color || "",
        createdAt: new Date().toISOString()
      };

      e.layer.remove();

      setFeatures((prev) => [...prev, feature]);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      if (areaSelectionModeRef.current) return;

      const pm = map.pm;
      if (
        pm?.globalDrawModeEnabled?.() ||
        pm?.globalEditModeEnabled?.() ||
        pm?.globalRemovalModeEnabled?.() ||
        pm?.globalDragModeEnabled?.()
      ) {
        return;
      }

      showNspdObjectInfo(e.latlng);

      if (redClickModeRef.current) {
        drawRedCadastralFromNspdClick(e.latlng);
      }
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, []);


  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    map.setMaxBounds(MAP_MAX_BOUNDS);
    map.setMinZoom(MAP_MIN_ZOOM);
    map.setMaxZoom(MAP_MAX_ZOOM);

    if (adminBoundaryLayerRef.current && !map.hasLayer(adminBoundaryLayerRef.current)) {
      adminBoundaryLayerRef.current.addTo(map);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    Object.values(userLayerGroupsRef.current).forEach((group) => {
      if (map.hasLayer(group)) map.removeLayer(group);
    });
    userLayerGroupsRef.current = {};

    for (const layerInfo of layers) {
      const group = L.featureGroup();
      userLayerGroupsRef.current[layerInfo.id] = group;

      const layerFeatures = features.filter((f) => f.properties?.layerId === layerInfo.id);
      for (const feature of layerFeatures) {
        const gj = featureToLeaflet(feature, layerInfo.color);
        gj.eachLayer((leafletLayer) => {
          leafletLayer.bindPopup(popupHtml(feature));

          leafletLayer.on("pm:update", () => {
            const updated = leafletLayer.toGeoJSON();
            updated.id = feature.id;
            updated.properties = feature.properties;
            setFeatures((prev) => prev.map((item) => (item.id === feature.id ? updated : item)));
          });

          leafletLayer.on("pm:remove", () => {
            setFeatures((prev) => prev.filter((item) => item.id !== feature.id));
          });

          group.addLayer(leafletLayer);
        });
      }

      if (layerInfo.visible) group.addTo(map);
    }
  }, [layers, features]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const existingIds = new Set(Object.keys(nspdLayerGroupsRef.current));
    const currentIds = new Set(nspdLayers.map((layer) => layer.id));
    const orderedNspdLayers = nspdSubcategories.flatMap((group) =>
      nspdLayers.filter((layer) => (layer.groupId || "other") === group.id)
    );
    const groupedIds = new Set(orderedNspdLayers.map((layer) => layer.id));
    nspdLayers.forEach((layer) => {
      if (!groupedIds.has(layer.id)) orderedNspdLayers.push(layer);
    });

    // Удаляем Leaflet-слои, которых больше нет в списке.
    existingIds.forEach((id) => {
      if (!currentIds.has(id)) {
        const leafletLayer = nspdLayerGroupsRef.current[id];
        if (leafletLayer && map.hasLayer(leafletLayer)) map.removeLayer(leafletLayer);
        delete nspdLayerGroupsRef.current[id];
      }
    });

    orderedNspdLayers.forEach((item, index) => {
      let existing = nspdLayerGroupsRef.current[item.id];
      const areaBoundsKey = makeAreaBoundsKey(item.areaBounds);

      // Если изменилось ограничение выбранной области — пересоздать WMS, чтобы Leaflet применил bounds.
      if (existing && existing._customAreaBoundsKey !== areaBoundsKey) {
        if (map.hasLayer(existing)) map.removeLayer(existing);
        delete nspdLayerGroupsRef.current[item.id];
        existing = null;
      }

      // Если слой выключен или не настроен — убрать с карты, но оставить в списке.
      if (!item.visible || !item.url || !item.layers) {
        if (existing && map.hasLayer(existing)) {
          map.removeLayer(existing);
        }
        return;
      }

      // Если слой включён впервые — создать и добавить.
      if (!existing) {
        const tileBounds = makeLeafletBoundsFromArea(item.areaBounds);
        const wms = isCadastralFgLayer(item)
          ? createCadastralTileLayer(item)
          : L.tileLayer.wms(normalizeNspdWmsUrl(item.url), {
              layers: item.layers,
              format: "image/png",
              transparent: true,
              version: "1.3.0",
              crs: L.CRS.EPSG3857,
              tileSize: 512,
              bounds: tileBounds,
              opacity: item.opacity ?? 0.85,
              zIndex: 300 + index,
              attribution: envNspdAttribution
            });

        wms._customAreaBoundsKey = areaBoundsKey;
        if (typeof wms.setZIndex === "function") wms.setZIndex(300 + index);
        nspdLayerGroupsRef.current[item.id] = wms;
        wms.addTo(map);

        if (isCadastralFgLayer(item) && map.getZoom() < 15) {
          map.setZoom(16);
        }

        return;
      }

      // Если слой уже создан — синхронизировать прозрачность, порядок и видимость.
      existing.setOpacity(item.opacity ?? 0.85);
      if (typeof existing.setZIndex === "function") existing.setZIndex(300 + index);

      if (!map.hasLayer(existing)) {
        existing.addTo(map);
      }

      if (isCadastralFgLayer(item) && map.getZoom() < 15) {
        map.setZoom(16);
      }
    });
  }, [nspdLayers, nspdSubcategories]);

  function addLayer() {
    const name = window.prompt("Название нового слоя:", "Новый слой");
    if (!name) return;

    const color = autoLayerColor(layers.length);
    const newLayer = { id: uid("layer"), name, color, visible: true };

    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  }

  function toggleLayer(layerId) {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  }

  function removeLayer(layerId) {
    const layerInfo = layers.find((l) => l.id === layerId);
    if (!layerInfo) return;

    const ok = window.confirm(`Удалить слой "${layerInfo.name}" и все его объекты?`);
    if (!ok) return;

    const restLayers = layers.filter((l) => l.id !== layerId);
    setLayers(restLayers);
    setFeatures((prev) => prev.filter((f) => f.properties?.layerId !== layerId));
    setActiveLayerId(restLayers[0]?.id || "");
  }

  function toggleNspdLayer(id) {
    setNspdLayers((prev) =>
      prev.map((layer) => (layer.id === id ? { ...layer, visible: !layer.visible } : layer))
    );
  }

  function updateNspdLayer(id, patch) {
    setNspdLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  }

  function removeNspdLayer(id) {
    const leafletLayer = nspdLayerGroupsRef.current[id];
    if (leafletLayer && mapRef.current?.hasLayer(leafletLayer)) {
      mapRef.current.removeLayer(leafletLayer);
    }
    delete nspdLayerGroupsRef.current[id];

    setNspdLayers((prev) => prev.filter((layer) => layer.id !== id));
  }

  function toggleNspdExpanded(id) {
    setNspdLayers((prev) =>
      prev.map((layer) => (layer.id === id ? { ...layer, expanded: !layer.expanded } : layer))
    );
  }


  function addNspdGroup() {
    const rawName = window.prompt("Название новой категории:", "Новая категория");
    const name = String(rawName || "").trim();
    if (!name) {
      if (rawName !== null) alert("Название категории обязательно.");
      return;
    }

    setNspdGroups((prev) => {
      if (normalizeGroupName(name) === normalizeGroupName("НСПД") || hasDuplicateNspdGroupName(prev, null, name)) {
        alert("Категория с таким названием уже существует.");
        return prev;
      }
      return [...prev, { id: uid("nspd_group"), name, expanded: true, parentId: null, type: "category", system: false }];
    });
  }

  function addNspdSubcategory(parentId) {
    const parent = nspdGroups.find((group) => group.id === parentId && group.type === "category");
    if (!parent) return;
    const rawName = window.prompt("Название новой подкатегории:", "Новая подкатегория");
    const name = String(rawName || "").trim();
    if (!name) {
      if (rawName !== null) alert("Название подкатегории обязательно.");
      return;
    }

    setNspdGroups((prev) => {
      if (hasDuplicateNspdGroupName(prev, parentId, name)) {
        alert("Подкатегория с таким названием уже существует в этой категории.");
        return prev;
      }
      const subcategory = { id: uid("nspd_group"), name, expanded: true, parentId, type: "subcategory", system: false };
      setNewNspdGroupId(subcategory.id);
      return prev
        .map((group) => (group.id === parentId ? { ...group, expanded: true } : group))
        .concat(subcategory);
    });
  }

  function updateNspdGroup(id, patch) {
    setNspdGroups((prev) => prev.map((group) => (group.id === id ? { ...group, ...patch } : group)));
  }

  function removeNspdGroup(id) {
    const group = nspdGroups.find((item) => item.id === id);
    if (!group) return;
    if (group.id === NSPD_ROOT_GROUP_ID || group.system) {
      alert("Системную категорию НСПД и ее системные разделы удалять нельзя.");
      return;
    }
    const hasChildren = nspdGroups.some((item) => item.parentId === id);
    const hasLayers = nspdLayers.some((layer) => (layer.groupId || "other") === id);
    if (hasChildren) {
      alert("Сначала удалите или перенесите подкатегории внутри этой категории.");
      return;
    }
    if (hasLayers) {
      alert("Сначала переместите или удалите слои из этой подкатегории.");
      return;
    }
    const ok = window.confirm(`Удалить "${group.name}"?`);
    if (!ok) return;
    setNspdGroups((prev) => prev.filter((item) => item.id !== id));
    if (newNspdGroupId === id) setNewNspdGroupId(getDefaultNspdSubcategoryId(nspdGroups));
  }

  function moveNspdGroup(id, direction) {
    setNspdGroups((prev) => {
      const index = prev.findIndex((group) => group.id === id);
      if (index < 0) return prev;
      const siblings = prev
        .map((group, groupIndex) => ({ group, groupIndex }))
        .filter((item) => (item.group.parentId || null) === (prev[index].parentId || null));
      const siblingIndex = siblings.findIndex((item) => item.group.id === id);
      const targetSibling = siblings[siblingIndex + direction];
      if (!targetSibling) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(targetSibling.groupIndex, 0, item);
      return copy;
    });
  }

  function moveNspdLayer(id, direction) {
    setNspdLayers((prev) => reorderNspdLayer(prev, id, id, null, direction));
  }

  function moveUserLayerByDrop(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setLayers((prev) => {
      const from = prev.findIndex((layer) => layer.id === sourceId);
      const to = prev.findIndex((layer) => layer.id === targetId);
      if (from < 0 || to < 0) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }

  function moveNspdGroupByDrop(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setNspdGroups((prev) => {
      const from = prev.findIndex((group) => group.id === sourceId);
      const to = prev.findIndex((group) => group.id === targetId);
      if (from < 0 || to < 0) return prev;
      if ((prev[from].parentId || null) !== (prev[to].parentId || null)) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }

  function reorderNspdLayer(list, sourceId, targetId, targetGroupId = null, direction = 0) {
    const sourceIndex = list.findIndex((layer) => layer.id === sourceId);
    if (sourceIndex < 0) return list;

    const source = list[sourceIndex];
    const nextGroupId = targetGroupId || source.groupId || "other";
    const copy = [...list];
    copy.splice(sourceIndex, 1);

    if (direction !== 0) {
      const sameGroup = copy
        .map((layer, index) => ({ layer, index }))
        .filter((item) => (item.layer.groupId || "other") === nextGroupId);
      const oldPosition = list
        .filter((layer) => (layer.groupId || "other") === nextGroupId)
        .findIndex((layer) => layer.id === sourceId);
      const newPosition = Math.max(0, Math.min(sameGroup.length, oldPosition + direction));
      const insertIndex = sameGroup[newPosition]?.index ?? copy.length;
      copy.splice(insertIndex, 0, { ...source, groupId: nextGroupId });
      return copy;
    }

    const targetIndex = copy.findIndex((layer) => layer.id === targetId);
    const insertIndex = targetIndex >= 0 ? targetIndex : copy.length;
    copy.splice(insertIndex, 0, { ...source, groupId: nextGroupId });
    return copy;
  }

  function moveNspdLayerByDrop(sourceId, targetId, targetGroupId) {
    if (!sourceId) return;
    setNspdLayers((prev) => reorderNspdLayer(prev, sourceId, targetId, targetGroupId));
  }

  function clearNspdLayers() {
    const ok = window.confirm("Удалить все НСПД-слои?");
    if (!ok) return;

    Object.values(nspdLayerGroupsRef.current).forEach((leafletLayer) => {
      if (mapRef.current?.hasLayer(leafletLayer)) {
        mapRef.current.removeLayer(leafletLayer);
      }
    });
    nspdLayerGroupsRef.current = {};
    setNspdLayers([]);
  }

  function dedupeCurrentNspdLayers() {
    setNspdLayers((prev) => dedupeNspdLayers(prev));
  }

  function addNspdLayer() {
    const layerId = String(newWmsLayers || "").trim();
    const targetGroupId = nspdSubcategories.some((group) => group.id === newNspdGroupId)
      ? newNspdGroupId
      : getDefaultNspdSubcategoryId(nspdGroups);

    if (!layerId) {
      alert("Укажите ID слоя НСПД");
      return;
    }

    if (!/^\d+$/.test(layerId)) {
      alert("ID слоя НСПД должен состоять только из цифр, например 36048");
      return;
    }

    if (!targetGroupId) {
      alert("Сначала создайте подкатегорию для слоя.");
      return;
    }

    setNspdLayers((prev) => [
      ...prev,
      {
        id: uid("nspd"),
        name: `НСПД слой ${layerId}`,
        url: buildNspdWmsUrl(layerId),
        layers: layerId,
        visible: true,
        groupId: targetGroupId,
        opacity: 0.75,
        expanded: false
      }
    ]);

    setNewWmsName("");
    setNewWmsUrl("");
    setNewWmsLayers("");
  }


  async function loadBarnaulAdminBoundary() {
    const map = mapRef.current;
    if (!map) return;

    if (adminBoundaryLayerRef.current) {
      return;
    }

    try {
      setAdminBoundaryLoading(true);
      setAdminBoundaryError("");

      const params = new URLSearchParams({
        city: "Барнаул",
        state: "Алтайский край",
        country: "Россия",
        format: "json",
        polygon_geojson: "1",
        addressdetails: "1",
        limit: "1"
      });

      const response = await fetch(`/nominatim/search?${params}`);
      if (!response.ok) throw new Error("Не удалось получить границу Барнаула");

      const data = await response.json();
      const found = data.find((item) => item.geojson) || data[0];

      if (!found?.geojson) {
        throw new Error("В ответе нет GeoJSON-границы");
      }

      const layer = L.geoJSON(found.geojson, {
        interactive: false,
        style: {
          color: "#0284c7",
          weight: 4,
          opacity: 1,
          fill: false,
          dashArray: "10 7",
          lineCap: "round"
        }
      });

      adminBoundaryLayerRef.current = layer;

      layer.addTo(map);

      // Не меняем текущий зум при загрузке границы, только добавляем контур.
    } catch (error) {
      console.warn("Ошибка загрузки административной границы", error);

      const fallbackLayer = L.geoJSON(BARNAUL_ADMIN_BOUNDARY_FALLBACK, {
        interactive: false,
        style: {
          color: "#0284c7",
          weight: 4,
          opacity: 1,
          fill: false,
          dashArray: "10 7",
          lineCap: "round"
        }
      });

      adminBoundaryLayerRef.current = fallbackLayer;
      fallbackLayer.addTo(map);
      setAdminBoundaryError("");
    } finally {
      setAdminBoundaryLoading(false);
    }
  }

  useEffect(() => {
    if (!mapRef.current) return;

    loadBarnaulAdminBoundary();
    if (adminBoundaryLayerRef.current && !mapRef.current.hasLayer(adminBoundaryLayerRef.current)) {
      adminBoundaryLayerRef.current.addTo(mapRef.current);
    }
  }, []);

  function copySelectedLayersLink() {
    const map = mapRef.current;
    const state = {
      nspdLayers: nspdLayers.filter((layer) => layer.visible && layer.url && layer.layers),
      center: map ? [map.getCenter().lat, map.getCenter().lng] : BARNAUL_CENTER,
      zoom: map ? map.getZoom() : 12
    };

    const encoded = btoa(encodeURIComponent(JSON.stringify(state)));
    const url = `${window.location.origin}${window.location.pathname}?state=${encoded}`;

    navigator.clipboard
      ?.writeText(url)
      .then(() => alert("Ссылка на выбранные слои скопирована"))
      .catch(() => window.prompt("Скопируйте ссылку:", url));
  }

  function startAreaSelection() {
    const map = mapRef.current;
    if (!map) return;

    alert("Нарисуйте прямоугольник на карте. После завершения область будет выбрана.");

    areaSelectionModeRef.current = true;

    map.pm.enableDraw("Rectangle", {
      snappable: true,
      pathOptions: {
        color: "#f97316",
        weight: 3,
        fillOpacity: 0.08
      }
    });

    map.once("pm:create", (e) => {
      const bounds = e.layer.getBounds();

      if (selectedAreaRef.current && map.hasLayer(selectedAreaRef.current)) {
        map.removeLayer(selectedAreaRef.current);
      }

      selectedAreaRef.current = e.layer;
      selectedAreaRef.current.setStyle({
        color: "#f97316",
        weight: 3,
        fillOpacity: 0.08
      });

      const area = {
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast()
      };

      setSelectedAreaBounds(area);
      setAreaLayerIds(nspdLayers.filter((layer) => layer.visible).map((layer) => layer.id));
      map.pm.disableDraw("Rectangle");

      setTimeout(() => {
        areaSelectionModeRef.current = false;
      }, 0);
    });
  }

  function clearSelectedArea() {
    const map = mapRef.current;

    if (selectedAreaRef.current && map?.hasLayer(selectedAreaRef.current)) {
      map.removeLayer(selectedAreaRef.current);
    }

    selectedAreaRef.current = null;
    setSelectedAreaBounds(null);
    setAreaLayerIds([]);
    setNspdLayers((prev) => prev.map((layer) => ({ ...layer, areaBounds: null })));
  }

  function toggleAreaLayer(id) {
    setAreaLayerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function applyAreaLayerSelection() {
    if (!selectedAreaBounds) {
      alert("Сначала выберите область");
      return;
    }

    Object.values(nspdLayerGroupsRef.current).forEach((leafletLayer) => {
      if (mapRef.current?.hasLayer(leafletLayer)) mapRef.current.removeLayer(leafletLayer);
    });
    nspdLayerGroupsRef.current = {};

    setNspdLayers((prev) =>
      prev.map((layer) => {
        const selected = areaLayerIds.includes(layer.id);
        return {
          ...layer,
          visible: selected,
          areaBounds: selected ? selectedAreaBounds : null
        };
      })
    );

    const map = mapRef.current;
    if (map) {
      map.fitBounds([
        [selectedAreaBounds.south, selectedAreaBounds.west],
        [selectedAreaBounds.north, selectedAreaBounds.east]
      ]);
    }
  }

  function parseCoordinates(value) {
    const normalized = value
      .trim()
      .replace(/,/g, ".")
      .replace(/[;|]/g, " ")
      .replace(/\s+/g, " ");

    const parts = normalized.match(/-?\d+(\.\d+)?/g);
    if (!parts || parts.length < 2) return null;

    let first = Number(parts[0]);
    let second = Number(parts[1]);

    if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

    let lat = first;
    let lng = second;

    if (Math.abs(first) > 60 && Math.abs(second) <= 60) {
      lat = second;
      lng = first;
    }

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

    return { lat, lng };
  }

  function searchPointByCoordinates() {
    const point = parseCoordinates(coordinateInput);
    if (!point) {
      alert("Введите координаты в формате: 53.348 83.780 или 83.780, 53.348");
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    const latlng = [point.lat, point.lng];

    if (coordinateMarkerRef.current && map.hasLayer(coordinateMarkerRef.current)) {
      map.removeLayer(coordinateMarkerRef.current);
    }

    coordinateMarkerRef.current = L.marker(latlng)
      .addTo(map)
      .bindPopup(`Координаты:<br/>${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`)
      .openPopup();

    map.setView(latlng, 17);
  }


  function toggleCiasExportLayer(id) {
    setCiasExportLayerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function selectAllCiasLayers() {
    setCiasExportLayerIds(layers.map((layer) => layer.id));
  }

  function clearCiasLayers() {
    setCiasExportLayerIds([]);
  }

  function getGeometryCoordinatePairs(geometry) {
    if (!geometry) return [];

    let coords = [];

    if (geometry.type === "Point") {
      coords = [geometry.coordinates];
    } else if (geometry.type === "LineString") {
      coords = geometry.coordinates || [];
    } else if (geometry.type === "Polygon") {
      coords = geometry.coordinates?.[0] || [];
    } else if (geometry.type === "MultiPoint") {
      coords = geometry.coordinates || [];
    } else if (geometry.type === "MultiLineString") {
      coords = geometry.coordinates?.[0] || [];
    } else if (geometry.type === "MultiPolygon") {
      coords = geometry.coordinates?.[0]?.[0] || [];
    }

    // Для полигонов Leaflet часто добавляет последнюю точку, совпадающую с первой.
    // В исходной таблице ЦИАС обычно перечислены вершины без повторного замыкания.
    if (coords.length > 1) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (
        Array.isArray(first) &&
        Array.isArray(last) &&
        Number(first[0]) === Number(last[0]) &&
        Number(first[1]) === Number(last[1])
      ) {
        coords = coords.slice(0, -1);
      }
    }

    return coords.slice(0, 27);
  }

  function normalizeColorForCias(color) {
    return String(color || "00b4cc").replace("#", "").trim();
  }

  function buildCiasHeaders() {
    return [
      "Наименование объекта",
      "Координаты",
      "Описание",
      "Цвет",
      "Информация"
    ];
  }

  function formatNumberForCias(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";

    // Оставляем разумную точность и убираем лишние нули.
    return Number(number.toFixed(7)).toString();
  }

  function formatCoordinatesForCias(value) {
    if (!Array.isArray(value)) return "[]";

    if (typeof value[0] === "number") {
      return `[${formatNumberForCias(value[0])}, ${formatNumberForCias(value[1])}]`;
    }

    return `[${value.map((item) => formatCoordinatesForCias(item)).join(", ")}]`;
  }

  function getFeatureGeometryForCias(feature) {
    if (!feature?.geometry) return "";

    // Важно: ЦИАС чувствителен к формату строки.
    // Шаблон КДХТ хранит GeoJSON не компактно, а так:
    // {"type": "Polygon", "coordinates": [[[83.1, 53.1], ...]]}
    // Поэтому не используем JSON.stringify(geometry), который даёт:
    // {"type":"Polygon","coordinates":[...]}
    const geometry = feature.geometry;
    return `{"type": "${geometry.type}", "coordinates": ${formatCoordinatesForCias(
      geometry.coordinates
    )}}`;
  }

  function exportCiasExcel() {
    if (!ciasExportLayerIds.length) {
      alert("Выберите хотя бы один слой для экспорта в ЦИАС");
      return;
    }

    const layerById = Object.fromEntries(layers.map((layer) => [layer.id, layer]));
    const selectedFeatures = features.filter((feature) =>
      ciasExportLayerIds.includes(feature.properties?.layerId)
    );

    if (!selectedFeatures.length) {
      alert("В выбранных слоях нет объектов для экспорта");
      return;
    }

    const headers = buildCiasHeaders();

    const rows = selectedFeatures.map((feature) => {
      const layer = layerById[feature.properties?.layerId];
      const props = feature.properties || {};

      return {
        "Наименование объекта": props.name || "Объект",
        "Координаты": getFeatureGeometryForCias(feature),
        "Описание":
          props.objectDescription ||
          props.description ||
          props.caseInfo ||
          props.courtDecision ||
          "",
        "Цвет": normalizeColorForCias(
          props.color || layer?.color || "00b4cc"
        ),
        "Информация":
          props.info ||
          props.information ||
          (props.objectDescription ? "" : props.description) ||
          `Слой: ${props.layerName || layer?.name || ""}`
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });

    worksheet["!cols"] = [
      { wch: 70 },
      { wch: 90 },
      { wch: 55 },
      { wch: 14 },
      { wch: 90 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Лист1");

    // В шаблоне КДХТ только один лист. Дополнительные листы не добавляем,
    // чтобы ЦИАС не пытался прочитать служебную инструкцию как данные.
    const fileName = `КДХТ_ЦИАС_экспорт_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName, {
      bookType: "xlsx",
      bookSST: false
    });
  }

  function normalizeAddressQuery(query) {
    const trimmed = query.trim();
    if (!trimmed) return "";
    return /барнаул/i.test(trimmed) ? trimmed : `${trimmed}, Барнаул`;
  }

  async function searchAddressWithNominatim(query) {
    const params = new URLSearchParams({
      format: "json",
      addressdetails: "1",
      limit: "7",
      countrycodes: "ru",
      q: normalizeAddressQuery(query)
    });

    const response = await fetch(`/nominatim/search?${params}`);
    if (!response.ok) return [];

    const data = await response.json();

    return data
      .filter((item) => {
        const label = String(item.display_name || "").toLowerCase();
        return label.includes("барнаул") || label.includes("barnaul");
      })
      .map((item) => ({
        id: `nominatim_${item.place_id}`,
        label: item.display_name,
        lat: Number(item.lat),
        lon: Number(item.lon)
      }));
  }

  async function searchAddressWithPhoton(query) {
    const params = new URLSearchParams({
      q: normalizeAddressQuery(query),
      lat: "53.347996",
      lon: "83.779806",
      limit: "7",
      lang: "ru"
    });

    const response = await fetch(`https://photon.komoot.io/api/?${params}`);
    if (!response.ok) return [];

    const data = await response.json();

    return (data.features || [])
      .map((feature, index) => {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];
        const parts = [
          props.name,
          props.street,
          props.housenumber,
          props.city,
          props.district,
          props.state
        ].filter(Boolean);

        return {
          id: `photon_${props.osm_id || index}`,
          label: parts.join(", ") || props.name || "Адрес",
          lat: Number(coords[1]),
          lon: Number(coords[0])
        };
      })
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
  }

  async function searchAddressSuggestions(query = addressSearchInput) {
    const value = query.trim();
    if (value.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    try {
      setAddressLoading(true);

      let results = [];

      try {
        results = await searchAddressWithNominatim(value);
      } catch (error) {
        console.warn("Nominatim не ответил", error);
      }

      if (!results.length) {
        try {
          results = await searchAddressWithPhoton(value);
        } catch (error) {
          console.warn("Photon не ответил", error);
        }
      }

      const seen = new Set();
      const unique = results.filter((item) => {
        const key = `${item.lat.toFixed(6)}:${item.lon.toFixed(6)}:${item.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setAddressSuggestions(unique);
      setAddressSearchOpen(true);
    } finally {
      setAddressLoading(false);
    }
  }

  function selectAddressSuggestion(suggestion) {
    const map = mapRef.current;
    if (!map || !Number.isFinite(suggestion.lat) || !Number.isFinite(suggestion.lon)) return;

    const latlng = [suggestion.lat, suggestion.lon];

    if (addressMarkerRef.current && map.hasLayer(addressMarkerRef.current)) {
      map.removeLayer(addressMarkerRef.current);
    }

    addressMarkerRef.current = L.marker(latlng)
      .addTo(map)
      .bindPopup(`<b>Адрес</b><br/>${suggestion.label}`)
      .openPopup();

    map.setView(latlng, 17);
    setAddressSearchInput(suggestion.label);
    setAddressSuggestions([]);
    setAddressSearchOpen(false);
  }

  function clearAddressSearch() {
    setAddressSearchInput("");
    setAddressSuggestions([]);
    setAddressSearchOpen(false);

    if (addressMarkerRef.current && mapRef.current?.hasLayer(addressMarkerRef.current)) {
      mapRef.current.removeLayer(addressMarkerRef.current);
    }
  }


  function mercatorPointToLatLng(point) {
    const x = Number(point?.x ?? point?.[0]);
    const y = Number(point?.y ?? point?.[1]);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    const lng = (x / 20037508.34) * 180;
    let lat = (y / 20037508.34) * 180;
    lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);

    return [lat, lng];
  }

  function featureToRedLayer(feature, cadastralNumber) {
    const attrs = feature?.attrs || {};
    const cn = attrs.cn || cadastralNumber;

    if (feature?.geometry?.type && feature?.geometry?.coordinates) {
      return L.geoJSON(
        {
          type: "Feature",
          properties: { cn },
          geometry: feature.geometry
        },
        {
          style: {
            color: "#ff0000",
            weight: 4,
            fillOpacity: 0.04
          }
        }
      );
    }

    const extent = feature?.extent;
    if (extent) {
      const sw = mercatorPointToLatLng({ x: extent.xmin, y: extent.ymin });
      const ne = mercatorPointToLatLng({ x: extent.xmax, y: extent.ymax });

      if (sw && ne) {
        return L.rectangle([sw, ne], {
          color: "#ff0000",
          weight: 4,
          fillOpacity: 0.03
        }).bindPopup(`<b>${cn}</b><br/>Контур построен по extent объекта`);
      }
    }

    const center = feature?.center;
    const latlng = mercatorPointToLatLng(center);

    if (latlng) {
      return L.circleMarker(latlng, {
        radius: 9,
        color: "#ff0000",
        weight: 4,
        fillOpacity: 0.2
      }).bindPopup(`<b>${cn}</b><br/>Найдена только центральная точка`);
    }

    return null;
  }

  async function readJsonIfPossible(response) {
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      return {
        __rawText: text,
        __status: response.status
      };
    }
  }

  function pickFeatureFromPkkResponse(data, cadastralNumber) {
    if (!data) return null;

    if (data.feature) return data.feature;

    if (data?.features?.length) {
      const exact = data.features.find((item) => item?.attrs?.cn === cadastralNumber);
      return exact || data.features[0];
    }

    if (data?.results?.length) {
      const exact = data.results.find((item) => item?.attrs?.cn === cadastralNumber);
      return exact || data.results[0];
    }

    return null;
  }

  async function fetchPkkFeatureByCadNumber(cadastralNumber) {
    // Важно: двоеточия в кадастровом номере оставляем как есть.
    // Некоторые старые API ПКК ломаются, если передать 22%3A63%3A...
    const raw = cadastralNumber.trim();
    const encodedForQuery = encodeURIComponent(raw);

    const urls = [
      // pkk5.rosreestr.ru
      `/pkk/api/features/1/${raw}`,
      `/pkk/api/features/5/${raw}`,
      `/pkk/api/features/1?text=${encodedForQuery}&limit=5&tolerance=2`,
      `/pkk/api/features/5?text=${encodedForQuery}&limit=5&tolerance=2`,

      // pkk.rosreestr.ru fallback
      `/pkkros/api/features/1/${raw}`,
      `/pkkros/api/features/5/${raw}`,
      `/pkkros/api/features/1?text=${encodedForQuery}&limit=5&tolerance=2`,
      `/pkkros/api/features/5?text=${encodedForQuery}&limit=5&tolerance=2`
    ];

    const errors = [];

    for (const url of urls) {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          errors.push(`${url} → HTTP ${response.status}`);
          continue;
        }

        const data = await readJsonIfPossible(response);
        const feature = pickFeatureFromPkkResponse(data, raw);

        if (feature) return feature;

        errors.push(`${url} → объект не найден`);
      } catch (error) {
        errors.push(`${url} → ${error.message}`);
      }
    }

    console.warn(`Не удалось получить ${raw}`, errors);
    return {
      __notFound: true,
      __errors: errors
    };
  }


  function getTargetCadNumbers() {
    return redCadastralNumbers
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getFeatureCadNumber(feature) {
    const props = feature?.properties || feature?.attrs || {};
    return (
      props.cn ||
      props.cadnum ||
      props.cadastral_number ||
      props.objectCn ||
      props["properties_cn"] ||
      ""
    );
  }

  function getVisibleQueryableNspdLayers() {
    return nspdLayersRef.current
      .filter((layer) => layer?.visible && layer?.url && layer?.layers)
      // Leaflet рисует более поздние WMS поверх предыдущих, поэтому сначала спрашиваем верхний слой.
      .slice()
      .reverse();
  }

  function getNspdInfoChoices() {
    return getVisibleQueryableNspdLayers().map((layer) => ({
      id: layer.id,
      name: layer.name || `НСПД слой ${layer.layers}`,
      layers: layer.layers
    }));
  }

  function buildGetFeatureInfoUrl(latlng, layerInfo = null) {
    const map = mapRef.current;
    const layerId = String(layerInfo?.layers || "36048").trim();
    const baseUrl = normalizeNspdWmsUrl(layerInfo?.url || buildNspdWmsUrl(layerId));

    if (!map) {
      const point3857 = L.CRS.EPSG3857.project(latlng);
      const buffer = 100;
      const bbox = [
        point3857.x - buffer,
        point3857.y - buffer,
        point3857.x + buffer,
        point3857.y + buffer
      ].join(",");

      const params = new URLSearchParams({
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetFeatureInfo",
        LAYERS: layerId,
        QUERY_LAYERS: layerId,
        CRS: "EPSG:3857",
        BBOX: bbox,
        WIDTH: "800",
        HEIGHT: "800",
        I: "400",
        J: "400",
        INFO_FORMAT: "application/json",
        STYLES: "",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        FEATURE_COUNT: "10",
        RANDOM: Math.random().toString()
      });

      return `${baseUrl}?${params.toString()}`;
    }

    const size = map.getSize();
    const bounds = map.getBounds();
    const sw = L.CRS.EPSG3857.project(bounds.getSouthWest());
    const ne = L.CRS.EPSG3857.project(bounds.getNorthEast());
    const point = map.latLngToContainerPoint(latlng);

    const params = new URLSearchParams({
      SERVICE: "WMS",
      VERSION: "1.3.0",
      REQUEST: "GetFeatureInfo",
      LAYERS: layerId,
      QUERY_LAYERS: layerId,
      CRS: "EPSG:3857",
      BBOX: [sw.x, sw.y, ne.x, ne.y].join(","),
      WIDTH: Math.round(size.x).toString(),
      HEIGHT: Math.round(size.y).toString(),
      I: Math.round(point.x).toString(),
      J: Math.round(point.y).toString(),
      INFO_FORMAT: "application/json",
      STYLES: "",
      FORMAT: "image/png",
      TRANSPARENT: "true",
      FEATURE_COUNT: "10",
      RANDOM: Math.random().toString()
    });

    return `${baseUrl}?${params.toString()}`;
  }

  function getNspdResponseFeatures(data) {
    if (Array.isArray(data?.features)) return data.features;
    if (Array.isArray(data?.FeatureCollection?.features)) return data.FeatureCollection.features;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeTextKey(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9]+/g, "");
  }


  const NSPD_FIELD_LABELS = {
    cadastralDistrictsCode: "Код кадастрового округа",
    cadastralDistrictCode: "Код кадастрового округа",
    cadastralRegionCode: "Код кадастрового района",
    cadastralQuarterCode: "Код кадастрового квартала",
    cadastralQuarter: "Кадастровый квартал",
    category: "Категория",
    descr: "Описание",
    description: "Описание",
    externalKey: "Внешний ключ",
    external_key: "Внешний ключ",
    geom_data_id: "ID геометрии",
    geomDataId: "ID геометрии",
    floors: "Этажность",
    floor: "Этаж",
    status: "Статус",
    statusName: "Статус",
    state: "Статус",
    cad_num: "Кадастровый номер",
    cadNum: "Кадастровый номер",
    cadnum: "Кадастровый номер",
    cn: "Кадастровый номер",
    cadastralNumber: "Кадастровый номер",
    purpose: "Назначение",
    materials: "Материалы стен",
    material: "Материал",
    cost_index: "Удельный показатель кадастровой стоимости",
    costIndex: "Удельный показатель кадастровой стоимости",
    cost_value: "Кадастровая стоимость",
    costValue: "Кадастровая стоимость",
    cost: "Кадастровая стоимость",
    cadCost: "Кадастровая стоимость",
    right_type: "Вид права",
    rightType: "Вид права",
    ownership: "Форма собственности",
    year_built: "Год постройки",
    yearBuilt: "Год постройки",
    buildYear: "Год постройки",
    address: "Адрес",
    readableAddress: "Адрес",
    area: "Площадь",
    area_value: "Площадь",
    areaValue: "Площадь",
    square: "Площадь",
    totalArea: "Площадь",
    objectType: "Вид объекта недвижимости",
    object_type: "Вид объекта недвижимости",
    typeName: "Тип объекта",
    name: "Название",
    title: "Название",
    layer: "Слой",
    layers: "Слой",
    id: "ID",
    objectid: "ID объекта",
    objectId: "ID объекта",
    uuid: "UUID",
    guid: "GUID",
    type: "Тип",
    subtype: "Подтип",
    utilization: "Использование",
    usage: "Использование",
    permittedUse: "Вид разрешенного использования",
    permitted_use: "Вид разрешенного использования",
    byDocument: "По документу",
    by_document: "По документу",
    date_create: "Дата создания",
    dateCreated: "Дата создания",
    date_reg: "Дата регистрации",
    regDate: "Дата регистрации",
    assignDate: "Дата присвоения",
    registrationDate: "Дата регистрации",
    updated: "Дата обновления",
    updateDate: "Дата обновления",
    cadastral_cost: "Кадастровая стоимость",
    specificCadCost: "Удельный показатель кадастровой стоимости",
    specific_cad_cost: "Удельный показатель кадастровой стоимости",
    unitCost: "Удельный показатель кадастровой стоимости",
    unit_cost: "Удельный показатель кадастровой стоимости",
    number: "Номер",
    code: "Код",
    value: "Значение"
  };

  const NSPD_NORMALIZED_FIELD_LABELS = Object.fromEntries(
    Object.entries(NSPD_FIELD_LABELS).map(([key, value]) => [normalizeTextKey(key), value])
  );

  const FIELD_WORD_TRANSLATIONS = {
    cad: "кадастровый",
    cadastral: "кадастровый",
    district: "округ",
    districts: "округа",
    region: "район",
    quarter: "квартал",
    code: "код",
    num: "номер",
    number: "номер",
    key: "ключ",
    external: "внешний",
    geom: "геометрия",
    geometry: "геометрия",
    data: "данные",
    id: "ID",
    object: "объект",
    realty: "недвижимость",
    estate: "недвижимость",
    land: "земельный участок",
    parcel: "участок",
    building: "здание",
    construction: "сооружение",
    room: "помещение",
    flat: "квартира",
    address: "адрес",
    readable: "читаемый",
    full: "полный",
    status: "статус",
    state: "состояние",
    category: "категория",
    type: "тип",
    kind: "вид",
    subtype: "подтип",
    purpose: "назначение",
    usage: "использование",
    use: "использование",
    utilization: "использование",
    permitted: "разрешенное",
    allowed: "разрешенное",
    document: "документ",
    right: "право",
    rights: "права",
    ownership: "собственность",
    owner: "собственник",
    form: "форма",
    value: "значение",
    cost: "стоимость",
    price: "цена",
    index: "показатель",
    specific: "удельный",
    unit: "удельный",
    area: "площадь",
    square: "площадь",
    total: "общая",
    specified: "уточненная",
    date: "дата",
    assign: "присвоения",
    assigned: "присвоения",
    registration: "регистрации",
    reg: "регистрации",
    created: "создания",
    create: "создания",
    updated: "обновления",
    update: "обновления",
    start: "начала",
    end: "окончания",
    year: "год",
    built: "постройки",
    build: "постройки",
    floors: "этажность",
    floor: "этаж",
    material: "материал",
    materials: "материалы",
    wall: "стены",
    walls: "стены",
    name: "название",
    title: "название",
    description: "описание",
    descr: "описание",
    layer: "слой",
    layers: "слои",
    feature: "объект",
    count: "количество",
    length: "длина",
    width: "ширина",
    height: "высота",
    cadastralnumber: "кадастровый номер",
    cadnum: "кадастровый номер",
    cadnumber: "кадастровый номер",
    externalkey: "внешний ключ",
    geomdataid: "ID геометрии",
    righttype: "вид права",
    costindex: "удельный показатель кадастровой стоимости",
    costvalue: "кадастровая стоимость",
    yearbuilt: "год постройки",
    objecttype: "вид объекта недвижимости",
    permitteduse: "вид разрешенного использования"
  };

  const FIELD_PHRASE_TRANSLATIONS = {
    cadastralDistrictsCode: "Код кадастрового округа",
    cadastralDistrictCode: "Код кадастрового округа",
    cadastralRegionCode: "Код кадастрового района",
    cadastralQuarterCode: "Код кадастрового квартала",
    cadastralQuarter: "Кадастровый квартал",
    cadastralNumber: "Кадастровый номер",
    cadNum: "Кадастровый номер",
    cad_num: "Кадастровый номер",
    externalKey: "Внешний ключ",
    external_key: "Внешний ключ",
    geom_data_id: "ID геометрии",
    geomDataId: "ID геометрии",
    right_type: "Вид права",
    rightType: "Вид права",
    cost_index: "Удельный показатель кадастровой стоимости",
    costIndex: "Удельный показатель кадастровой стоимости",
    cost_value: "Кадастровая стоимость",
    costValue: "Кадастровая стоимость",
    year_built: "Год постройки",
    yearBuilt: "Год постройки",
    buildYear: "Год постройки",
    objectType: "Вид объекта недвижимости",
    object_type: "Вид объекта недвижимости",
    permittedUse: "Вид разрешенного использования",
    permitted_use: "Вид разрешенного использования",
    areaValue: "Площадь",
    area_value: "Площадь",
    totalArea: "Общая площадь",
    specifiedArea: "Уточненная площадь",
    specified_area: "Уточненная площадь",
    readableAddress: "Адрес",
    fullAddress: "Полный адрес",
    statusName: "Статус",
    typeName: "Тип объекта",
    dateCreated: "Дата создания",
    date_create: "Дата создания",
    dateUpdated: "Дата обновления",
    date_update: "Дата обновления",
    registrationDate: "Дата регистрации",
    assignDate: "Дата присвоения",
    unitCost: "Удельный показатель кадастровой стоимости",
    unit_cost: "Удельный показатель кадастровой стоимости"
  };

  const FIELD_PHRASE_NORMALIZED = Object.fromEntries(
    Object.entries(FIELD_PHRASE_TRANSLATIONS).map(([key, value]) => [normalizeTextKey(key), value])
  );

  function splitTechnicalWords(value) {
    return String(value || "")
      .replace(/^properties[._]/i, "")
      .replace(/^attributes[._]/i, "")
      .replace(/^attrs[._]/i, "")
      .split(/[.[\]]+/)
      .filter(Boolean)
      .pop()
      ?.replace(/([a-zа-яё0-9])([A-ZА-ЯЁ])/g, "$1 $2")
      .replace(/([A-ZА-ЯЁ]+)([A-ZА-ЯЁ][a-zа-яё])/g, "$1 $2")
      .replace(/[_\-:/]+/g, " ")
      .split(/\s+/)
      .filter(Boolean) || [];
  }

  function capitalizeRu(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function translateTechnicalLabel(label) {
    const raw = String(label || "").trim();
    if (!raw) return "Поле";

    const short = raw
      .replace(/^properties[._]/i, "")
      .replace(/^attributes[._]/i, "")
      .replace(/^attrs[._]/i, "")
      .split(/[.[\]]+/)
      .filter(Boolean)
      .pop() || raw;

    if (NSPD_FIELD_LABELS[short]) return NSPD_FIELD_LABELS[short];
    if (FIELD_PHRASE_TRANSLATIONS[short]) return FIELD_PHRASE_TRANSLATIONS[short];

    const normalized = normalizeTextKey(short);
    if (NSPD_NORMALIZED_FIELD_LABELS[normalized]) return NSPD_NORMALIZED_FIELD_LABELS[normalized];
    if (FIELD_PHRASE_NORMALIZED[normalized]) return FIELD_PHRASE_NORMALIZED[normalized];

    if (/^[а-яё0-9\s.,:;()\-\/]+$/i.test(short) && /[а-яё]/i.test(short)) {
      return capitalizeRu(short);
    }

    const words = splitTechnicalWords(short);
    const translated = words.map((word) => {
      const clean = word.toLowerCase();
      return FIELD_WORD_TRANSLATIONS[clean] || FIELD_WORD_TRANSLATIONS[normalizeTextKey(clean)] || word;
    });

    const hasRussianTranslation = translated.some((word, index) => word !== words[index] && /[а-яё]/i.test(word));
    if (hasRussianTranslation) {
      return capitalizeRu(translated.join(" "));
    }

    return short
      .replace(/_/g, " ")
      .replace(/([a-zа-яё])([A-ZА-ЯЁ])/g, "$1 $2")
      .replace(/\b[a-zа-яё]/g, (char) => char.toUpperCase())
      .trim();
  }

  function humanizeTechnicalLabel(label) {
    return translateTechnicalLabel(label);
  }

  function formatNspdValueByLabel(label, value) {
    const normalized = normalizeTextKey(label);
    if (normalized.includes("date") || normalized.includes("дата")) return formatDateRu(value);
    if (normalized.includes("cost") || normalized.includes("стоим")) return formatMoneyRu(value);
    if (normalized.includes("area") || normalized.includes("square") || normalized.includes("площад")) return formatAreaRu(value);
    return String(value ?? "");
  }

  function formatDateRu(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
    return text;
  }

  function formatMoneyRu(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const number = Number(raw.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(number)) return raw;
    return `${number.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`;
  }

  function formatAreaRu(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (/кв|м²|м2/i.test(raw)) return raw;
    const number = Number(raw.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(number)) return raw;
    return `${number.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} кв. м`;
  }

  function isHiddenNspdInfoPair(pair, finalLabel = "") {
    const rawKey = normalizeTextKey(pair?.key || "");
    const rawLabel = normalizeTextKey(pair?.label || "");
    const label = normalizeTextKey(finalLabel || pair?.label || pair?.key || "");
    const value = normalizeTextKey(pair?.value || "");
    const joined = `${rawKey} ${rawLabel} ${label}`;

    if (joined.includes("subcategory") || joined.includes("sub category")) return true;
    if (joined.includes("registrationnumbborder") || joined.includes("registrationnumberborder")) return true;
    if (joined.includes("registracii") && joined.includes("numb") && joined.includes("border")) return true;
    if (joined.includes("регистрации") && joined.includes("numb") && joined.includes("border")) return true;
    if (value === "22:63-6.1278" && joined.includes("border")) return true;

    return false;
  }

  function collectNspdPairs(node, out = [], path = "") {
    if (node === null || node === undefined) return out;

    if (Array.isArray(node)) {
      node.forEach((item, index) => collectNspdPairs(item, out, `${path}[${index}]`));
      return out;
    }

    if (typeof node !== "object") {
      if (path) out.push({ key: path, label: path.split(".").pop(), value: node });
      return out;
    }

    const label = node.name ?? node.title ?? node.label ?? node.caption ?? node.alias ?? node.displayName ?? node.fieldName;
    const value = node.value ?? node.val ?? node.text ?? node.displayValue ?? node.fieldValue;

    if (label !== undefined && value !== undefined && typeof value !== "object") {
      out.push({ key: String(label), label: String(label), value });
    }

    Object.entries(node).forEach(([key, val]) => {
      if (["geometry", "geom", "bbox", "extent"].includes(key)) return;
      if (["name", "title", "label", "caption", "alias", "displayName", "fieldName", "value", "val", "text", "displayValue", "fieldValue"].includes(key)) return;
      const nextPath = path ? `${path}.${key}` : key;
      if (val !== null && typeof val === "object") {
        collectNspdPairs(val, out, nextPath);
      } else if (val !== undefined && val !== null && String(val).trim() !== "") {
        out.push({ key: nextPath, label: key, value: val });
      }
    });

    return out;
  }

  function getFirstPairValue(pairs, aliases) {
    const normalizedAliases = aliases.map(normalizeTextKey);

    for (const pair of pairs) {
      const label = normalizeTextKey(pair.label);
      const key = normalizeTextKey(pair.key);
      if (normalizedAliases.some((alias) => label === alias || key === alias || label.includes(alias) || key.includes(alias))) {
        const value = String(pair.value ?? "").trim();
        if (value) return value;
      }
    }

    return "";
  }

  function makeNspdRowsFromFeature(feature, layerInfo = null) {
    const props = feature?.properties || feature?.attrs || feature?.attributes || feature || {};
    const pairs = collectNspdPairs(props);
    const rows = [];
    const used = new Set();
    const layerId = String(layerInfo?.layers || "").trim();

    if (layerId && layerId !== "36048") {
      pairs
        .filter((pair) => pair.value !== undefined && pair.value !== null && String(pair.value).trim() !== "")
        .filter((pair) => !isHiddenNspdInfoPair(pair, humanizeTechnicalLabel(pair.label || pair.key || "Поле")))
        .slice(0, 40)
        .forEach((pair) => {
          const label = humanizeTechnicalLabel(pair.label || pair.key || "Поле");
          const value = formatNspdValueByLabel(label, pair.value);
          const sig = `${label}:${value}`;
          if (!used.has(sig)) {
            used.add(sig);
            rows.push({ label, value });
          }
        });

      return rows;
    }

    const add = (label, aliases, formatter = (value) => value) => {
      const value = getFirstPairValue(pairs, aliases);
      if (!value) return;
      const formatted = formatter(value);
      if (!formatted) return;
      const sig = `${label}:${formatted}`;
      if (used.has(sig)) return;
      used.add(sig);
      rows.push({ label, value: formatted });
    };

    add("Вид объекта недвижимости", ["Вид объекта недвижимости", "objectType", "object_type", "typeName", "realtyType", "objType", "objectkind", "object_type_name"]);
    add("Вид земельного участка", ["Вид земельного участка", "landRecordType", "land_record_type", "landType", "land_type", "subtype", "purpose"]);
    add("Дата присвоения", ["Дата присвоения", "assignDate", "dateAssigned", "registrationDate", "date_create", "dateCreated", "date_reg", "regDate"], formatDateRu);
    add("Кадастровый номер", ["Кадастровый номер", "cn", "cadnum", "cad_num", "cadastralNumber", "cadastral_number", "objectCn", "number"]);
    add("Кадастровый квартал", ["Кадастровый квартал", "cadQuarter", "cad_quarter", "quarter", "quarterCn", "kvartal", "cadastralQuarter"]);
    add("Адрес", ["Адрес", "address", "readableAddress", "location", "addr", "fullAddress"]);
    add("Площадь уточненная", ["Площадь уточненная", "area", "areaValue", "area_value", "specifiedArea", "specified_area", "square", "totalArea"], formatAreaRu);
    add("Статус", ["Статус", "status", "statusName", "state", "objectStatus"]);
    add("Вид разрешенного использования", ["Вид разрешенного использования", "permittedUse", "permitted_use", "utilization", "utilisation", "usage", "allowedUse", "byDocument", "by_document", "useType"]);
    add("Форма собственности", ["Форма собственности", "ownership", "ownershipType", "ownership_type", "rightType", "rights"]);
    add("Кадастровая стоимость", ["Кадастровая стоимость", "cadCost", "cad_cost", "cadastralCost", "cadastral_cost", "cost", "kc"], formatMoneyRu);
    add("Удельный показатель кадастровой стоимости", ["Удельный показатель кадастровой стоимости", "specificCadCost", "specific_cad_cost", "unitCost", "unit_cost", "costPerMeter", "cost_per_meter"]);

    if (!rows.length) {
      pairs
        .filter((pair) => pair.value !== undefined && pair.value !== null && String(pair.value).trim() !== "")
        .filter((pair) => !isHiddenNspdInfoPair(pair, humanizeTechnicalLabel(pair.label || pair.key)))
        .slice(0, 25)
        .forEach((pair) => {
          const label = humanizeTechnicalLabel(pair.label || pair.key);
          rows.push({ label, value: formatNspdValueByLabel(label, pair.value) });
        });
    }

    return rows;
  }

  function getNspdFeatureTitle(feature, rows) {
    const cadastral = rows.find((row) => row.label === "Кадастровый номер")?.value || getFeatureCadNumber(feature);
    const objectType = rows.find((row) => row.label === "Вид объекта недвижимости")?.value || "Объект НСПД";
    return cadastral ? `${objectType}: ${cadastral}` : objectType;
  }

  function buildNspdInfoFromResponse(data, layerInfo = null) {
    const features = getNspdResponseFeatures(data);
    const layerName = layerInfo?.name || (layerInfo?.layers ? `НСПД слой ${layerInfo.layers}` : "НСПД слой");

    if (!features.length) {
      return {
        open: true,
        loading: false,
        title: layerName,
        rows: [],
        message: "Этот слой не вернул объект в точке клика. Попробуйте приблизить карту или кликнуть точнее по объекту слоя.",
        feature: null,
        layerInfo
      };
    }

    const feature = features[0];
    const rows = makeNspdRowsFromFeature(feature, layerInfo)
      .filter((row) => !isHiddenNspdInfoPair({ key: row.label, label: row.label, value: row.value }, row.label));

    if (!rows.some((row) => row.label === "Слой")) {
      rows.unshift({ label: "Слой", value: layerName });
    }

    return {
      open: true,
      loading: false,
      title: getNspdFeatureTitle(feature, rows) || layerName,
      rows,
      message: features.length > 1 ? `Найдено объектов: ${features.length}. Показан первый. Источник: ${layerName}.` : `Источник: ${layerName}`,
      feature,
      layerInfo
    };
  }

  function focusNspdFeatureNearPanel(feature, fallbackLatLng) {
    const map = mapRef.current;
    if (!map || !fallbackLatLng) return;

    // Не используем bounds из GetFeatureInfo для зума: НСПД иногда возвращает
    // несколько объектов или крупный квартал, из-за чего карта отдаляется до всего Барнаула.
    // Вместо этого центрируем именно точку клика в правой рабочей области рядом с панелью.
    const panelWidth = window.innerWidth <= 900 ? 0 : 460;
    const targetZoom = Math.max(map.getZoom(), 18);
    const targetPoint = map.project(fallbackLatLng, targetZoom);
    const centerPoint = targetPoint.subtract([Math.round(panelWidth / 2), 0]);
    const shiftedCenter = map.unproject(centerPoint, targetZoom);

    map.setView(shiftedCenter, targetZoom, { animate: true });
  }

  async function loadNspdObjectInfoForLayer(latlng, layerInfo) {
    if (!latlng || !layerInfo) return;

    setNspdInfo({
      open: true,
      loading: true,
      title: layerInfo.name || `НСПД слой ${layerInfo.layers}`,
      rows: [],
      message: `Запрашиваю данные слоя ${layerInfo.name || layerInfo.layers}...`,
      feature: null,
      layerInfo,
      choices: getNspdInfoChoices(),
      selectedLayerId: layerInfo.id
    });

    try {
      const response = await fetch(buildGetFeatureInfoUrl(latlng, layerInfo), {
        headers: { Accept: "application/json,text/plain,*/*" }
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        if (text && text.trim()) {
          setNspdInfo({
            open: true,
            loading: false,
            title: layerInfo.name || `НСПД слой ${layerInfo.layers}`,
            rows: [
              { label: "Слой", value: layerInfo.name || `НСПД слой ${layerInfo.layers}` },
              { label: "Ответ", value: text }
            ],
            message: "Слой вернул не JSON, показан сырой ответ.",
            feature: null,
            layerInfo,
            choices: getNspdInfoChoices(),
            selectedLayerId: layerInfo.id
          });
          focusNspdFeatureNearPanel(null, latlng);
          return;
        }

        throw new Error("Пустой или нечитаемый ответ слоя");
      }

      const features = getNspdResponseFeatures(data);
      if (!features.length) {
        setNspdInfo({
          open: true,
          loading: false,
          title: layerInfo.name || `НСПД слой ${layerInfo.layers}`,
          rows: [],
          message: "Этот слой не вернул объект в точке клика. Попробуйте приблизить карту или кликнуть точнее по объекту слоя.",
          feature: null,
          layerInfo,
          choices: getNspdInfoChoices(),
          selectedLayerId: layerInfo.id
        });
        focusNspdFeatureNearPanel(null, latlng);
        return;
      }

      const info = buildNspdInfoFromResponse(data, layerInfo);
      setNspdInfo({
        ...info,
        choices: getNspdInfoChoices(),
        selectedLayerId: layerInfo.id
      });
      focusNspdFeatureNearPanel(info.feature, latlng);
    } catch (error) {
      console.warn("Ошибка получения данных объекта НСПД", layerInfo, error);
      setNspdInfo({
        open: true,
        loading: false,
        title: layerInfo.name || `НСПД слой ${layerInfo.layers}`,
        rows: [],
        message: `Не удалось получить данные выбранного слоя: ${error.message}`,
        feature: null,
        layerInfo,
        choices: getNspdInfoChoices(),
        selectedLayerId: layerInfo.id
      });
      focusNspdFeatureNearPanel(null, latlng);
    }
  }

  async function chooseNspdInfoLayer(layerId) {
    const latlng = lastNspdClickLatLngRef.current;
    const layerInfo = getVisibleQueryableNspdLayers().find((layer) => layer.id === layerId);

    if (!latlng || !layerInfo) {
      setNspdInfo({
        open: true,
        loading: false,
        title: "Данные по объекту",
        rows: [],
        message: "Не удалось определить выбранный слой или точку клика. Кликните по карте ещё раз.",
        feature: null,
        choices: getNspdInfoChoices(),
        selectedLayerId: layerId || ""
      });
      return;
    }

    await loadNspdObjectInfoForLayer(latlng, layerInfo);
  }

  async function showNspdObjectInfo(latlng) {
    const map = mapRef.current;
    if (!map) return;

    map.closePopup();
    lastNspdClickLatLngRef.current = latlng;

    const queryLayers = getVisibleQueryableNspdLayers();
    if (!queryLayers.length) {
      setNspdInfo({
        open: true,
        loading: false,
        title: "Данные по объекту",
        rows: [],
        message: "Нет включённых НСПД-слоёв для запроса данных.",
        feature: null,
        choices: [],
        selectedLayerId: ""
      });
      return;
    }

    if (queryLayers.length === 1) {
      await loadNspdObjectInfoForLayer(latlng, queryLayers[0]);
      return;
    }

    setNspdInfo({
      open: true,
      loading: false,
      title: "Выберите слой",
      rows: [],
      message: "Включено несколько НСПД-слоёв. Выберите, из какого слоя показать данные в точке клика.",
      feature: null,
      choices: queryLayers.map((layer) => ({
        id: layer.id,
        name: layer.name || `НСПД слой ${layer.layers}`,
        layers: layer.layers
      })),
      selectedLayerId: ""
    });

    focusNspdFeatureNearPanel(null, latlng);
  }

  async function drawRedCadastralFromNspdClick(latlng) {
    const map = mapRef.current;
    if (!map) return;

    setRedCadastralLoading(true);
    setRedCadastralStatus("Запрашиваю объект НСПД по клику...");

    try {
      const response = await fetch(buildGetFeatureInfoUrl(latlng, { layers: "36048", url: buildNspdWmsUrl("36048") }));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const featuresFromNspd = data?.features || [];

      if (!featuresFromNspd.length) {
        setRedCadastralStatus("По клику НСПД не вернул объекты. Попробуйте кликнуть внутри участка и приблизить карту.");
        return;
      }

      const targets = getTargetCadNumbers();
      const matched = targets.length
        ? featuresFromNspd.filter((feature) => targets.includes(getFeatureCadNumber(feature)))
        : featuresFromNspd;

      if (!matched.length) {
        const found = featuresFromNspd.map(getFeatureCadNumber).filter(Boolean);
        setRedCadastralStatus(
          `Объект найден, но кадастровый номер не совпал. Найдено: ${found.join(", ") || "без номера"}`
        );
        return;
      }

      if (!redCadastralLayerRef.current) {
        redCadastralLayerRef.current = L.featureGroup().addTo(map);
      } else if (!map.hasLayer(redCadastralLayerRef.current)) {
        redCadastralLayerRef.current.addTo(map);
      }

      matched.forEach((feature) => {
        const cn = getFeatureCadNumber(feature);
        const layer = L.geoJSON(feature, {
          style: {
            color: "#ff0000",
            weight: 4,
            fillColor: "#ff0000",
            fillOpacity: 0.04
          }
        }).bindPopup(`<b>${cn || "Кадастровый объект"}</b>`);

        redCadastralLayerRef.current.addLayer(layer);
      });

      if (redCadastralLayerRef.current.getLayers().length > 0) {
        map.fitBounds(redCadastralLayerRef.current.getBounds(), { padding: [30, 30] });
      }

      const names = matched.map(getFeatureCadNumber).filter(Boolean);
      setRedCadastralStatus(`Отрисовано красным из НСПД: ${names.join(", ") || matched.length}`);
    } catch (error) {
      console.warn("GetFeatureInfo ошибка", error);
      setRedCadastralStatus(`Ошибка GetFeatureInfo НСПД: ${error.message}`);
    } finally {
      setRedCadastralLoading(false);
    }
  }

  function toggleRedClickMode() {
    setRedClickModeEnabled((prev) => !prev);
  }

  async function drawRedCadastralContours() {
    const map = mapRef.current;
    if (!map) return;

    const numbers = redCadastralNumbers
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!numbers.length) {
      setRedCadastralStatus("Введите хотя бы один кадастровый номер");
      return;
    }

    setRedCadastralLoading(true);
    setRedCadastralStatus("Ищу объекты...");

    if (redCadastralLayerRef.current && map.hasLayer(redCadastralLayerRef.current)) {
      map.removeLayer(redCadastralLayerRef.current);
    }

    const group = L.featureGroup();
    const notFound = [];

    for (const number of numbers) {
      const feature = await fetchPkkFeatureByCadNumber(number);

      if (!feature || feature.__notFound) {
        notFound.push(number);
        if (feature?.__errors?.length) {
          console.warn(`Ошибки по ${number}:`, feature.__errors);
        }
        continue;
      }

      const layer = featureToRedLayer(feature, number);

      if (!layer) {
        notFound.push(number);
        continue;
      }

      layer.bindPopup?.(
        `<b>${feature?.attrs?.cn || number}</b><br/>${feature?.attrs?.address || ""}`
      );
      group.addLayer(layer);
    }

    redCadastralLayerRef.current = group;
    group.addTo(map);

    if (group.getLayers().length > 0) {
      map.fitBounds(group.getBounds(), { padding: [30, 30] });
    }

    const foundCount = group.getLayers().length;
    setRedCadastralStatus(
      `Отрисовано: ${foundCount}. ${
        notFound.length
          ? `Не найдено или API ПКК не ответил: ${notFound.join(", ")}. Подробности в Console.`
          : "Все объекты найдены."
      }`
    );
    setRedCadastralLoading(false);
  }

  function clearRedCadastralContours() {
    const map = mapRef.current;
    if (redCadastralLayerRef.current && map?.hasLayer(redCadastralLayerRef.current)) {
      map.removeLayer(redCadastralLayerRef.current);
    }
    redCadastralLayerRef.current = null;
    setRedCadastralStatus("");
  }

  function exportGeoJson() {
    const collection = {
      type: "FeatureCollection",
      name: "custom_map_features",
      features
    };

    const blob = new Blob([JSON.stringify(collection, null, 2)], {
      type: "application/geo+json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "custom-map-features.geojson";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importGeoJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const imported = data.type === "FeatureCollection" ? data.features : [data];

        const layerId = activeLayerId;
        const layerInfo = layers.find((l) => l.id === layerId);

        const normalized = imported.map((feature) => ({
          ...feature,
          id: feature.id || uid("feature"),
          properties: {
            ...feature.properties,
            layerId,
            layerName: layerInfo?.name || "Импорт",
            importedAt: new Date().toISOString()
          }
        }));

        setFeatures((prev) => [...prev, ...normalized]);
        event.target.value = "";
      } catch {
        alert("Не удалось импортировать GeoJSON");
      }
    };

    reader.readAsText(file);
  }

  function clearAll() {
    const ok = window.confirm("Удалить все пользовательские объекты?");
    if (!ok) return;
    setFeatures([]);
  }

  function resetNspd() {
    const ok = window.confirm("Сбросить список НСПД-слоёв к начальному?");
    if (!ok) return;

    Object.values(nspdLayerGroupsRef.current).forEach((leafletLayer) => {
      if (mapRef.current?.hasLayer(leafletLayer)) {
        mapRef.current.removeLayer(leafletLayer);
      }
    });
    nspdLayerGroupsRef.current = {};
    setNspdGroups(collapseNspdGroups(defaultNspdGroups));
    setNspdLayers(turnOffNspdLayers(defaultNspdLayers));
  }

  function setMapOverviewMode(mode) {
    const config = MAP_VIEW_MODES[mode];
    if (!config) return;

    setOverviewMode(mode);
    mapRef.current?.fitBounds(config.bounds, {
      ...config.fitOptions,
      animate: true
    });
  }

  function zoomBarnaul() {
    setMapOverviewMode("barnaul");
  }

  const activeNspdLegendSections = useMemo(() => {
    return nspdSubcategories.flatMap((group) =>
      nspdLayers
        .filter((layer) => (layer.groupId || "other") === group.id && layer.visible)
        .flatMap((layer, index) => buildLegendSectionsForLayer(layer, index))
    );
  }, [nspdSubcategories, nspdLayers]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">GIS</div>
          <div>
            <h1>Геоинформационный портал</h1>
          </div>
        </div>

        <div className="overviewToggle" role="group" aria-label="Режим обзора карты">
          {Object.entries(MAP_VIEW_MODES).map(([mode, config]) => (
            <button
              key={mode}
              className={overviewMode === mode ? "active" : ""}
              onClick={() => setMapOverviewMode(mode)}
              type="button"
            >
              {config.label}
            </button>
          ))}
        </div>

        <section className="panel">
          <div className="panelHeader">
            <h2>Слои НСПД</h2>
            <button onClick={resetNspd}>сброс</button>
          </div>

          <div className="nspdGroups">
            {nspdGroups.filter((group) => group.type === "category" && !group.parentId).map((category) => {
              const subcategories = nspdGroups.filter((group) => group.parentId === category.id && group.type === "subcategory");
              const categoryLayerCount = subcategories.reduce(
                (total, subcategory) => total + nspdLayers.filter((layer) => (layer.groupId || "other") === subcategory.id).length,
                0
              );

              return (
                <div
                  className={draggedNspdGroupId === category.id ? "nspdGroup dragging" : "nspdGroup"}
                  key={category.id}
                  draggable={!category.system}
                  onDragStart={() => setDraggedNspdGroupId(category.id)}
                  onDragEnd={() => setDraggedNspdGroupId("")}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    moveNspdGroupByDrop(draggedNspdGroupId, category.id);
                    setDraggedNspdGroupId("");
                  }}
                >
                  <div className="nspdGroupHeader">
                    <button
                      className="nspdGroupTitle"
                      onClick={() => updateNspdGroup(category.id, { expanded: !category.expanded })}
                      title="Свернуть/развернуть категорию"
                    >
                      <span>{category.expanded ? "v" : ">"}</span>
                      <strong>{category.name}</strong>
                      <small>{categoryLayerCount}</small>
                    </button>

                    <div className="nspdOrderButtons">
                      <button onClick={() => addNspdSubcategory(category.id)} title="Создать подкатегорию">+</button>
                      {!category.system && (
                        <button onClick={() => removeNspdGroup(category.id)} title="Удалить пустую категорию">x</button>
                      )}
                    </div>
                  </div>

                  {category.expanded && (
                    <div className="nspdSubgroups">
                      {subcategories.map((subcategory) => {
                        const groupLayers = nspdLayers.filter((layer) => (layer.groupId || "other") === subcategory.id);

                        return (
                          <div
                            className={draggedNspdGroupId === subcategory.id ? "nspdSubgroup dragging" : "nspdSubgroup"}
                            key={subcategory.id}
                            draggable
                            onDragStart={() => setDraggedNspdGroupId(subcategory.id)}
                            onDragEnd={() => setDraggedNspdGroupId("")}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              moveNspdGroupByDrop(draggedNspdGroupId, subcategory.id);
                              setDraggedNspdGroupId("");
                            }}
                          >
                            <div className="nspdGroupHeader nspdSubgroupHeader">
                              <span className="dragHandle" title="Перетащить подкатегорию">=</span>
                              <button
                                className="nspdGroupTitle"
                                onClick={() => updateNspdGroup(subcategory.id, { expanded: !subcategory.expanded })}
                                title="Свернуть/развернуть подкатегорию"
                              >
                                <span>{subcategory.expanded ? "v" : ">"}</span>
                                <strong>{subcategory.name}</strong>
                                <small>{groupLayers.length}</small>
                              </button>

                              <div className="nspdOrderButtons">
                                {!subcategory.system && (
                                  <button onClick={() => removeNspdGroup(subcategory.id)} title="Удалить пустую подкатегорию">x</button>
                                )}
                              </div>
                            </div>

                            {subcategory.expanded && (
                              <div
                                className="layers nspdGroupLayers"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  moveNspdLayerByDrop(draggedNspdLayerId, "", subcategory.id);
                                  setDraggedNspdLayerId("");
                                }}
                              >
                                {groupLayers.map((layer) => (
                                  <div
                                    className={draggedNspdLayerId === layer.id ? "nspdCompactRow dragging" : "nspdCompactRow"}
                                    key={layer.id}
                                    draggable
                                    onDragStart={() => setDraggedNspdLayerId(layer.id)}
                                    onDragEnd={() => setDraggedNspdLayerId("")}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      moveNspdLayerByDrop(draggedNspdLayerId, layer.id, subcategory.id);
                                      setDraggedNspdLayerId("");
                                    }}
                                  >
                                    <span className="dragHandle" title="Перетащить слой">=</span>
                                    <input
                                      type="checkbox"
                                      checked={layer.visible}
                                      onChange={() => toggleNspdLayer(layer.id)}
                                      title={layer.visible ? "Скрыть слой" : "Показать слой"}
                                    />

                                    <button
                                      className={layer.visible ? "layer active nspdLayerButton" : "layer nspdLayerButton"}
                                      onClick={() => toggleNspdLayer(layer.id)}
                                      title="Показать/скрыть слой"
                                    >
                                      {layer.name}
                                    </button>

                                    <button
                                      className="iconButton"
                                      onClick={() => toggleNspdExpanded(layer.id)}
                                      title="Информация и настройки слоя"
                                    >
                                      i
                                    </button>

                                    {layer.expanded && (
                                      <div className="nspdDetails">
                                        <label>
                                          Название
                                          <input
                                            value={layer.name}
                                            onChange={(e) => updateNspdLayer(layer.id, { name: e.target.value })}
                                          />
                                        </label>

                                        <label>
                                          Подкатегория
                                          <select
                                            value={layer.groupId || getDefaultNspdSubcategoryId(nspdGroups)}
                                            onChange={(e) => updateNspdLayer(layer.id, { groupId: e.target.value })}
                                          >
                                            {nspdSubcategories.map((item) => (
                                              <option key={item.id} value={item.id}>{getNspdGroupLabel(item, nspdGroups)}</option>
                                            ))}
                                          </select>
                                        </label>

                                        <label>
                                          ID слоя НСПД
                                          <input
                                            value={layer.layers}
                                            onChange={(e) => {
                                              const nextId = e.target.value.trim();
                                              updateNspdLayer(layer.id, {
                                                layers: nextId,
                                                url: nextId ? buildNspdWmsUrl(nextId) : ""
                                              });
                                            }}
                                            placeholder="Например 36048"
                                          />
                                        </label>

                                        <label>
                                          Прозрачность: {Math.round((layer.opacity ?? 0.85) * 100)}%
                                          <input
                                            type="range"
                                            min="0.1"
                                            max="1"
                                            step="0.05"
                                            value={layer.opacity ?? 0.85}
                                            onChange={(e) =>
                                              updateNspdLayer(layer.id, { opacity: Number(e.target.value) })
                                            }
                                          />
                                        </label>

                                        <button className="dangerWide" onClick={() => removeNspdLayer(layer.id)}>
                                          удалить НСПД-слой
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {!groupLayers.length && <div className="emptyGroup">В этой подкатегории пока нет слоев</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {!subcategories.length && <div className="emptyGroup">В этой категории пока нет подкатегорий</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button className="secondaryWide" onClick={addNspdGroup}>+ Создать категорию</button>

          {nspdLayers.some((layer) => layer.visible && isCadastralFgLayer(layer)) && currentZoom < 15 && (
            <div className="warningBox">
              Кадастровые границы отображаются только при приближении. Текущий zoom: {currentZoom}. Нужно 15+.
            </div>
          )}

          <details className="detailsBox">
            <summary>+ Добавить слой НСПД</summary>

            <div className="addWms">
              <select
                value={newNspdGroupId}
                onChange={(e) => setNewNspdGroupId(e.target.value)}
                title="Подкатегория для нового слоя"
              >
                {nspdSubcategories.map((group) => (
                  <option key={group.id} value={group.id}>{getNspdGroupLabel(group, nspdGroups)}</option>
                ))}
              </select>

              <input
                value={newWmsLayers}
                onChange={(e) => setNewWmsLayers(e.target.value.replace(/\D/g, ""))}
                placeholder="Введите только ID слоя, например 36048"
                inputMode="numeric"
              />

              <button onClick={addNspdLayer}>+ добавить слой</button>
            </div>
          </details>

          <details className="detailsBox techDetails">
            <summary>Технические действия</summary>

            <div className="miniActions">
              <button onClick={dedupeCurrentNspdLayers}>Убрать дубли</button>
              <button className="dangerWide" onClick={clearNspdLayers}>
                Очистить НСПД
              </button>
            </div>
          </details>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>Мои слои</h2>
            <button onClick={addLayer}>+ слой</button>
          </div>

          <label>
            Активный слой
            <select value={activeLayerId} onChange={(e) => setActiveLayerId(e.target.value)}>
              {layers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name}
                </option>
              ))}
            </select>
          </label>

          <div className="layers">
            {layers.map((layer) => (
              <div
                className={draggedUserLayerId === layer.id ? "layerRow dragging" : "layerRow"}
                key={layer.id}
                draggable
                onDragStart={() => setDraggedUserLayerId(layer.id)}
                onDragEnd={() => setDraggedUserLayerId("")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  moveUserLayerByDrop(draggedUserLayerId, layer.id);
                  setDraggedUserLayerId("");
                }}
              >
                <span className="dragHandle" title="Перетащить слой">☰</span>
                <input
                  type="checkbox"
                  checked={layer.visible}
                  onChange={() => toggleLayer(layer.id)}
                />
                <span className="color" style={{ background: layer.color }} />
                <button
                  className={layer.id === activeLayerId ? "layer active" : "layer"}
                  onClick={() => setActiveLayerId(layer.id)}
                >
                  {layer.name}
                </button>
                <button className="danger" onClick={() => removeLayer(layer.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>Экспорт в ЦИАС</h2>
            <button onClick={exportCiasExcel}>Excel</button>
          </div>

          <p className="smallText">
            Выберите пользовательские слои для выгрузки в шаблон КДХТ/ЦИАС: Наименование объекта, Координаты, Описание, Цвет, Информация.
          </p>

          <div className="miniActions">
            <button onClick={selectAllCiasLayers}>Все</button>
            <button onClick={clearCiasLayers}>Снять</button>
          </div>

          <div className="areaLayers">
            {layers.map((layer) => (
              <label className="check" key={layer.id}>
                <input
                  type="checkbox"
                  checked={ciasExportLayerIds.includes(layer.id)}
                  onChange={() => toggleCiasExportLayer(layer.id)}
                />
                <span className="color" style={{ background: layer.color }} />
                {layer.name}
              </label>
            ))}
          </div>

          <div className="stats">
            К экспорту: <b>
              {features.filter((feature) => ciasExportLayerIds.includes(feature.properties?.layerId)).length}
            </b> объектов<br />
            Формат: <b>КДХТ/ЦИАС</b>
          </div>
        </section>

      </aside>

      <main className="mapWrap">
        <div className="floatingTools">
          <div className={addressSearchOpen || addressSearchInput ? "addressSearch active" : "addressSearch"}>
            <span className="addressIcon">⌕</span>
            <input
              value={addressSearchInput}
              onFocus={() => setAddressSearchOpen(true)}
              onChange={(e) => {
                setAddressSearchInput(e.target.value);
                setAddressSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchAddressSuggestions();
              }}
              placeholder="Улица и дом"
            />
            {addressSearchInput && (
              <>
                <button className="addressGo" onClick={() => searchAddressSuggestions()} title="Искать">
                  →
                </button>
                <button className="addressClear" onClick={clearAddressSearch} title="Очистить">
                  ×
                </button>
              </>
            )}

            {(addressSearchOpen || addressSuggestions.length > 0) && (
              <div className="addressSuggestBox">
                {addressLoading && <div className="addressSuggest muted">Ищу адрес…</div>}

                {!addressLoading && addressSearchInput.trim().length >= 3 && addressSuggestions.length === 0 && (
                  <div className="addressSuggest muted">
                    Ничего не найдено. Попробуйте: “Ленина 10, Барнаул” или нажмите Enter.
                  </div>
                )}

                {addressSuggestions.map((item) => (
                  <button
                    key={item.id}
                    className="addressSuggest"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectAddressSuggestion(item)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className={floatingToolOpen === "area" ? "floatBtn active" : "floatBtn"}
            onClick={() => setFloatingToolOpen(floatingToolOpen === "area" ? null : "area")}
            title="Выбор области"
          >
            ▣
          </button>

          <button
            className={floatingToolOpen === "coords" ? "floatBtn active" : "floatBtn"}
            onClick={() => setFloatingToolOpen(floatingToolOpen === "coords" ? null : "coords")}
            title="Поиск точки по координатам"
          >
            ⌖
          </button>

          {floatingToolOpen === "area" && (
            <div className="floatPanel">
              <b>Выбор области</b>
              <p>Нарисуйте прямоугольник на карте, затем выберите НСПД-слои. Они будут загружаться только внутри выбранной области.</p>
              <button onClick={startAreaSelection}>Нарисовать область</button>

              {selectedAreaBounds && (
                <div className="floatAreaBox">
                  <div className="coords">
                    Юг: {selectedAreaBounds.south.toFixed(6)}<br />
                    Запад: {selectedAreaBounds.west.toFixed(6)}<br />
                    Север: {selectedAreaBounds.north.toFixed(6)}<br />
                    Восток: {selectedAreaBounds.east.toFixed(6)}
                  </div>

                  <div className="floatLayerList">
                    {nspdLayers.map((layer) => (
                      <label className="check" key={layer.id}>
                        <input
                          type="checkbox"
                          checked={areaLayerIds.includes(layer.id)}
                          onChange={() => toggleAreaLayer(layer.id)}
                        />
                        {layer.name}
                      </label>
                    ))}
                  </div>

                  <div className="actions">
                    <button onClick={applyAreaLayerSelection}>Применить</button>
                    <button className="dangerWide" onClick={clearSelectedArea}>
                      Очистить
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {floatingToolOpen === "coords" && (
            <div className="floatPanel">
              <b>Поиск по координатам</b>
              <input
                value={coordinateInput}
                onChange={(e) => setCoordinateInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchPointByCoordinates();
                }}
                placeholder="53.348 83.780"
              />
              <button onClick={searchPointByCoordinates}>Найти точку</button>
            </div>
          )}
        </div>


        {activeNspdLegendSections.length > 0 && (
          <details className="functionalLegendPanel nspdLegendPanel">
            <summary>Легенда</summary>

            <div className="legendContent">
              {activeNspdLegendSections.map((section) => (
                <div className="legendSection" key={section.id}>
                  <div className="legendSectionTitle">{section.title}</div>
                  {section.items.map((item, itemIndex) => (
                    <div className="legendItem nspdLegendItem" key={`${section.id}_${itemIndex}`}>
                      <span className="legendSwatch" style={item.swatch} />
                      <div>
                        <b>{item.label}</b>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
        )}

        <div ref={mapEl} className="map" />

        {nspdInfo.open && (
          <div className="nspdObjectPanel">
            <div className="nspdObjectHeader">
              <div>
                <div className="nspdObjectTitle">{nspdInfo.title}</div>
                <div className="nspdObjectSubtitle">Информация</div>
              </div>
              <button onClick={() => setNspdInfo((prev) => ({ ...prev, open: false }))}>×</button>
            </div>

            {nspdInfo.choices?.length > 0 && (
              <div className="nspdLayerSelectorBox">
                <label>Показать информацию из слоя</label>
                <select
                  value={nspdInfo.selectedLayerId || ""}
                  onChange={(e) => chooseNspdInfoLayer(e.target.value)}
                >
                  <option value="" disabled>
                    Выберите активный слой
                  </option>
                  {nspdInfo.choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name} · ID {choice.layers}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {nspdInfo.choices?.length && !nspdInfo.selectedLayerId && !nspdInfo.rows.length ? (
              <div className="nspdInfoLayerChoices">
                <div className="nspdObjectMessage">{nspdInfo.message}</div>
                {nspdInfo.choices.map((choice) => (
                  <button
                    key={choice.id}
                    onClick={() => chooseNspdInfoLayer(choice.id)}
                    title={`Показать данные слоя ${choice.layers}`}
                  >
                    <span>{choice.name}</span>
                    <small>ID {choice.layers}</small>
                  </button>
                ))}
              </div>
            ) : nspdInfo.loading ? (
              <div className="nspdObjectMessage">{nspdInfo.message}</div>
            ) : nspdInfo.rows.length ? (
              <div className="nspdObjectRows">
                {nspdInfo.rows.map((row) => (
                  <div className="nspdObjectRow" key={`${row.label}-${row.value}`}>
                    <div className="nspdObjectLabel">{row.label}</div>
                    <div className="nspdObjectValue">{row.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="nspdObjectMessage">{nspdInfo.message || "Данные не найдены"}</div>
            )}

            {nspdInfo.message && !nspdInfo.loading && nspdInfo.rows.length > 0 && (
              <div className="nspdObjectNote">{nspdInfo.message}</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
