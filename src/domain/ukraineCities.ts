/** Canonical map reference points used for coarse city-level search only. */
export interface CityMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  popular?: boolean;
  region: string;
}

export const UKRAINE_CITIES: CityMarker[] = [
  { id: 'kyiv', name: 'Київ', lat: 50.4501, lng: 30.5234, popular: true, region: 'Центр' },
  { id: 'odesa', name: 'Одеса', lat: 46.4825, lng: 30.7233, popular: true, region: 'Південь' },
  { id: 'lviv', name: 'Львів', lat: 49.8397, lng: 24.0297, popular: true, region: 'Захід' },
  { id: 'dnipro', name: 'Дніпро', lat: 48.4647, lng: 35.0462, popular: true, region: 'Схід' },
  { id: 'kharkiv', name: 'Харків', lat: 49.9935, lng: 36.2304, popular: true, region: 'Схід' },
  { id: 'vinnytsia', name: 'Вінниця', lat: 49.2331, lng: 28.4682, popular: true, region: 'Центр' },
  { id: 'uman', name: 'Умань', lat: 48.7484, lng: 30.2218, popular: true, region: 'Центр' },
  { id: 'stryi', name: 'Стрий', lat: 49.2562, lng: 23.8548, popular: true, region: 'Захід' },
  { id: 'poltava', name: 'Полтава', lat: 49.5883, lng: 34.5514, popular: true, region: 'Схід' },
  { id: 'zaporizhzhia', name: 'Запоріжжя', lat: 47.8388, lng: 35.1396, popular: true, region: 'Схід' },
  { id: 'zhytomyr', name: 'Житомир', lat: 50.2547, lng: 28.6587, popular: true, region: 'Північ' },
  { id: 'ivano_frankivsk', name: 'Івано-Франківськ', lat: 48.9226, lng: 24.7111, popular: true, region: 'Захід' },
  { id: 'chernivtsi', name: 'Чернівці', lat: 48.2921, lng: 25.9358, popular: true, region: 'Захід' },
  { id: 'rivne', name: 'Рівне', lat: 50.6199, lng: 26.2516, popular: true, region: 'Захід' },
  { id: 'ternopil', name: 'Тернопіль', lat: 49.5535, lng: 25.5948, popular: true, region: 'Захід' },
  { id: 'khmelnytskyi', name: 'Хмельницький', lat: 49.4230, lng: 26.9871, popular: true, region: 'Захід' },
  { id: 'cherkasy', name: 'Черкаси', lat: 49.4444, lng: 32.0598, popular: true, region: 'Центр' },
  { id: 'mykolaiv', name: 'Миколаїв', lat: 46.9750, lng: 31.9946, popular: true, region: 'Південь' },
  { id: 'kropyvnytskyi', name: 'Кропивницький', lat: 48.5079, lng: 32.2623, region: 'Центр' },
  { id: 'kremenchuk', name: 'Кременчук', lat: 49.0630, lng: 33.4040, region: 'Центр' },
  { id: 'bila_tserkva', name: 'Біла Церква', lat: 49.7989, lng: 30.1153, popular: true, region: 'Центр' },
  { id: 'lutsk', name: 'Луцьк', lat: 50.7472, lng: 25.3254, region: 'Захід' },
  { id: 'uzhhorod', name: 'Ужгород', lat: 48.6208, lng: 22.2879, region: 'Захід' },
];
