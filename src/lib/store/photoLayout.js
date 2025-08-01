import { writable } from 'svelte/store'
import { user } from './userStore.js'

export const PhotoLayout = {
  SIDE_BY_SIDE: {
    value: 'side-by-side',
    icon: 'splitscreen_left'
  },
  TOP_AND_BELOW: {
    value: 'top-and-below',
    icon: 'splitscreen_top'
  },
  FULL_PHOTO: {
    value: 'full-photo',
    icon: 'fullscreen_portrait'
  }
}

export const photoLayoutOptions = Object.values(PhotoLayout)

export const defaultPhotoLayout = writable(PhotoLayout.SIDE_BY_SIDE.value)

export const getIconForLayout = (layoutValue) => {
  const layout = Object.values(PhotoLayout).find(l => l.value === layoutValue)
  return layout ? layout.icon : ''
}

user.subscribe($user => {
  const defaultValue = $user?.defaultPhotoLayout || PhotoLayout.SIDE_BY_SIDE.value;
  defaultPhotoLayout.set(defaultValue)
})