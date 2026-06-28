export type CityId = "BJ" | "SH" | "XA" | "CQ"

export type PoiCategory =
  | "attraction"
  | "restaurant"
  | "experience"
  | "shopping"
  | "nightlife"

export type POI = {
  id: string
  cityId: CityId
  name: string
  nameZh: string
  coverImage?: string
  category: PoiCategory
  description: string
  highlights: string[]
  tips: string[]
  cautions: string[]
  tags: string[]
  lat: number
  lng: number
  district: string
  hours: string
  openingHoursRaw?: string
  closingHoursRaw?: string
  duration: number
  price: number
  indoor: boolean
  bestTime: string
  suitableFor: string[]
  seasonalNotes: number[]
  bookingRequired: boolean
  foreignFriendly: number | null
  signatureDishes: string[]
}

export type CuisineDish = {
  id: string
  cityId: CityId
  poiIds: string[]
  name: string
  nameZh: string
  category: string
  dietaryTags: string[]
  description: string
  imageKey?: string
}

export type CityConnection = {
  fromCityId: CityId
  toCityId: CityId
  travelMode: "high_speed_rail" | "flight" | "bus" | "drive"
  durationMin: number
  priceLevel: number
  frequency: string
  notes: string
}

export type TransportHub = {
  id: string
  cityId: CityId
  name: string
  nameZh: string
  type: "airport" | "railway_station" | "transport_hub"
  description: string
  tips: string[]
  cautions: string[]
  tags: string[]
  lat: number
  lng: number
  district: string
  openingHours: string
  foreignFriendly: number | null
}

export type TravelConstraint = {
  id: string
  cityId?: CityId | null
  poiId?: string | null
  type: string
  title: string
  startDate: string
  endDate: string
  recurrencePattern: "daily" | "weekly" | "monthly" | "seasonal" | "yearly"
  severity: "info" | "warning" | "avoid"
  impact: string
  action: string
}