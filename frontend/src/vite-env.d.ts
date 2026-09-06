/// <reference types="vite/client" />

/**
 * Координата [долгота, широта] в стандарте Yandex Maps 3.0
 */
export type LngLat = [number, number];

export interface YMapLocationRequest {
  center?: LngLat;
  zoom?: number;
  bounds?: [LngLat, LngLat];
  duration?: number;
}

export interface YMapProps {
  location: YMapLocationRequest;
  mode?: string;
  theme?: string;
}

export interface YMapEntity {
  _id?: string;
}

export interface YMapFeatureProps {
  geometry: {
    type: 'LineString' | 'Point' | 'Polygon';
    coordinates: LngLat[] | LngLat;
  };
  style?: {
    stroke?: Array<{
      color?: string;
      width?: number;
      opacity?: number;
      dash?: number[];
    }>;
    fill?: string;
  };
  properties?: Record<string, unknown>;
}

export interface YMapMarkerProps {
  coordinates: LngLat;
  title?: string;
  subtitle?: string;
  draggable?: boolean;
}

export interface YMapInstance {
  addChild(entity: YMapEntity): YMapInstance;
  removeChild(entity: YMapEntity): YMapInstance;
  setLocation(location: YMapLocationRequest): void;
  update(props: Partial<YMapProps>): void;
  destroy(): void;
}

export interface YMaps3Namespace {
  ready: Promise<unknown>;
  YMap: new (element: HTMLElement, props: YMapProps) => YMapInstance;
  YMapDefaultSchemeLayer: new (props?: Record<string, unknown>) => YMapEntity;
  YMapDefaultFeaturesLayer: new (props?: Record<string, unknown>) => YMapEntity;
  YMapFeature: new (props: YMapFeatureProps) => YMapEntity;
  YMapMarker: new (props: YMapMarkerProps, content?: HTMLElement) => YMapEntity;
  YMapControls?: new (props: { position: string }) => YMapEntity;
  YMapControl?: new (props?: Record<string, unknown>) => YMapEntity;
  import?: (pkgName: string) => Promise<unknown>;
}

declare global {
  interface Window {
    ymaps3?: YMaps3Namespace;
  }
  const ymaps3: YMaps3Namespace | undefined;
}

