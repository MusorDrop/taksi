/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ключ JavaScript API Яндекс Карт (https://developer.tech.yandex.ru/). Пустой/отсутствующий — показывается заглушка */
  readonly VITE_YANDEX_MAPS_APIKEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
