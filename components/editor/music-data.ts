export interface MusicLibraryTrack {
  id: string
  name: string
  genre: string
  duration: string
  url?: string
  // Track-specific config for audio generation
  config?: {
    bpm: number
    rootNote: number     // MIDI note for the root (60 = C4)
    chordProgression: number[][]  // Each chord is an array of MIDI notes
    melodyNotes: { note: number; startBeat: number; duration: number }[]
    bassPattern: number[]
    arpPattern: number[]
  }
}

export const MUSIC_LIBRARY: MusicLibraryTrack[] = [
  // Lo-fi
  {
    id: 'lofi-1', name: 'Chill Waves', genre: 'Lo-fi', duration: '3:24',
    config: {
      bpm: 78, rootNote: 65,
      chordProgression: [[65, 69, 72], [67, 71, 74], [63, 67, 70], [65, 69, 72]],
      melodyNotes: [
        { note: 76, startBeat: 0, duration: 1 }, { note: 74, startBeat: 1, duration: 0.5 },
        { note: 72, startBeat: 1.5, duration: 0.5 }, { note: 74, startBeat: 2, duration: 1 },
        { note: 72, startBeat: 3, duration: 0.5 }, { note: 69, startBeat: 3.5, duration: 0.5 },
        { note: 72, startBeat: 4, duration: 1 }, { note: 69, startBeat: 5, duration: 0.5 },
        { note: 67, startBeat: 5.5, duration: 0.5 }, { note: 65, startBeat: 6, duration: 1 },
        { note: 64, startBeat: 7, duration: 1 },
      ],
      bassPattern: [65, 67, 63, 65],
      arpPattern: [65, 69, 72, 69, 67, 71, 74, 71, 63, 67, 70, 67, 65, 69, 72, 69],
    }
  },
  {
    id: 'lofi-2', name: 'Coffee Shop', genre: 'Lo-fi', duration: '2:58',
    config: {
      bpm: 72, rootNote: 62,
      chordProgression: [[62, 66, 69], [64, 67, 71], [62, 65, 69], [60, 64, 67]],
      melodyNotes: [
        { note: 74, startBeat: 0, duration: 0.75 }, { note: 72, startBeat: 0.75, duration: 0.25 },
        { note: 74, startBeat: 1, duration: 0.5 }, { note: 69, startBeat: 1.5, duration: 0.5 },
        { note: 71, startBeat: 2, duration: 1 }, { note: 69, startBeat: 3, duration: 0.5 },
        { note: 67, startBeat: 3.5, duration: 0.5 }, { note: 66, startBeat: 4, duration: 1 },
        { note: 64, startBeat: 5, duration: 0.5 }, { note: 66, startBeat: 5.5, duration: 0.5 },
        { note: 69, startBeat: 6, duration: 1 }, { note: 67, startBeat: 7, duration: 1 },
      ],
      bassPattern: [62, 64, 62, 60],
      arpPattern: [62, 66, 69, 66, 64, 67, 71, 67, 62, 65, 69, 65, 60, 64, 67, 64],
    }
  },
  {
    id: 'lofi-3', name: 'Night Beats', genre: 'Lo-fi', duration: '3:12',
    config: {
      bpm: 85, rootNote: 67,
      chordProgression: [[67, 71, 74], [65, 69, 72], [67, 70, 74], [64, 68, 71]],
      melodyNotes: [
        { note: 79, startBeat: 0, duration: 0.5 }, { note: 77, startBeat: 0.5, duration: 0.5 },
        { note: 76, startBeat: 1, duration: 0.5 }, { note: 74, startBeat: 1.5, duration: 0.5 },
        { note: 76, startBeat: 2, duration: 1 }, { note: 74, startBeat: 3, duration: 0.5 },
        { note: 72, startBeat: 3.5, duration: 0.5 }, { note: 71, startBeat: 4, duration: 1 },
        { note: 74, startBeat: 5, duration: 0.5 }, { note: 72, startBeat: 5.5, duration: 0.5 },
        { note: 71, startBeat: 6, duration: 0.5 }, { note: 69, startBeat: 6.5, duration: 0.5 },
        { note: 67, startBeat: 7, duration: 1 },
      ],
      bassPattern: [67, 65, 67, 64],
      arpPattern: [67, 71, 74, 71, 65, 69, 72, 69, 67, 70, 74, 70, 64, 68, 71, 68],
    }
  },
  {
    id: 'lofi-4', name: 'Rainy Day', genre: 'Lo-fi', duration: '4:01',
    config: {
      bpm: 70, rootNote: 64,
      chordProgression: [[64, 68, 71], [62, 66, 69], [60, 64, 67], [62, 65, 69]],
      melodyNotes: [
        { note: 76, startBeat: 0, duration: 1.5 }, { note: 74, startBeat: 1.5, duration: 0.5 },
        { note: 72, startBeat: 2, duration: 1 }, { note: 71, startBeat: 3, duration: 0.5 },
        { note: 72, startBeat: 3.5, duration: 0.5 }, { note: 74, startBeat: 4, duration: 1 },
        { note: 71, startBeat: 5, duration: 0.5 }, { note: 69, startBeat: 5.5, duration: 0.5 },
        { note: 68, startBeat: 6, duration: 0.5 }, { note: 66, startBeat: 6.5, duration: 0.5 },
        { note: 64, startBeat: 7, duration: 1 },
      ],
      bassPattern: [64, 62, 60, 62],
      arpPattern: [64, 68, 71, 68, 62, 66, 69, 66, 60, 64, 67, 64, 62, 65, 69, 65],
    }
  },
  {
    id: 'lofi-5', name: 'Late Night', genre: 'Lo-fi', duration: '3:45',
    config: {
      bpm: 76, rootNote: 69,
      chordProgression: [[69, 73, 76], [67, 71, 74], [65, 69, 72], [64, 68, 71]],
      melodyNotes: [
        { note: 81, startBeat: 0, duration: 0.5 }, { note: 79, startBeat: 0.5, duration: 0.5 },
        { note: 78, startBeat: 1, duration: 0.5 }, { note: 76, startBeat: 1.5, duration: 0.5 },
        { note: 78, startBeat: 2, duration: 0.75 }, { note: 76, startBeat: 2.75, duration: 0.25 },
        { note: 74, startBeat: 3, duration: 0.5 }, { note: 73, startBeat: 3.5, duration: 0.5 },
        { note: 76, startBeat: 4, duration: 1 }, { note: 74, startBeat: 5, duration: 0.5 },
        { note: 73, startBeat: 5.5, duration: 0.5 }, { note: 71, startBeat: 6, duration: 1 },
        { note: 69, startBeat: 7, duration: 1 },
      ],
      bassPattern: [69, 67, 65, 64],
      arpPattern: [69, 73, 76, 73, 67, 71, 74, 71, 65, 69, 72, 69, 64, 68, 71, 68],
    }
  },
  {
    id: 'lofi-6', name: 'Study Session', genre: 'Lo-fi', duration: '5:02',
    config: {
      bpm: 74, rootNote: 62,
      chordProgression: [[62, 66, 69], [60, 64, 67], [58, 62, 65], [60, 63, 67]],
      melodyNotes: [
        { note: 74, startBeat: 0, duration: 0.5 }, { note: 72, startBeat: 0.5, duration: 0.5 },
        { note: 71, startBeat: 1, duration: 0.5 }, { note: 69, startBeat: 1.5, duration: 0.5 },
        { note: 71, startBeat: 2, duration: 0.5 }, { note: 72, startBeat: 2.5, duration: 0.5 },
        { note: 74, startBeat: 3, duration: 1 }, { note: 72, startBeat: 4, duration: 0.5 },
        { note: 71, startBeat: 4.5, duration: 0.5 }, { note: 69, startBeat: 5, duration: 1 },
        { note: 67, startBeat: 6, duration: 0.5 }, { note: 66, startBeat: 6.5, duration: 0.5 },
        { note: 64, startBeat: 7, duration: 1 },
      ],
      bassPattern: [62, 60, 58, 60],
      arpPattern: [62, 66, 69, 66, 60, 64, 67, 64, 58, 62, 65, 62, 60, 63, 67, 63],
    }
  },
  {
    id: 'lofi-7', name: 'Mellow Flow', genre: 'Lo-fi', duration: '3:30',
    config: {
      bpm: 80, rootNote: 67,
      chordProgression: [[67, 71, 74], [69, 72, 76], [65, 69, 72], [67, 70, 74]],
      melodyNotes: [
        { note: 79, startBeat: 0, duration: 1 }, { note: 78, startBeat: 1, duration: 0.5 },
        { note: 76, startBeat: 1.5, duration: 0.5 }, { note: 78, startBeat: 2, duration: 1 },
        { note: 76, startBeat: 3, duration: 0.5 }, { note: 74, startBeat: 3.5, duration: 0.5 },
        { note: 72, startBeat: 4, duration: 1 }, { note: 74, startBeat: 5, duration: 0.5 },
        { note: 76, startBeat: 5.5, duration: 0.5 }, { note: 78, startBeat: 6, duration: 1 },
        { note: 76, startBeat: 7, duration: 1 },
      ],
      bassPattern: [67, 69, 65, 67],
      arpPattern: [67, 71, 74, 71, 69, 72, 76, 72, 65, 69, 72, 69, 67, 70, 74, 70],
    }
  },

  // Hip Hop
  {
    id: 'hiphop-1', name: 'Street Beat', genre: 'Hip Hop', duration: '3:15',
    config: {
      bpm: 92, rootNote: 60,
      chordProgression: [[60, 64, 67], [58, 62, 65], [57, 60, 64], [58, 61, 65]],
      melodyNotes: [
        { note: 72, startBeat: 0, duration: 0.25 }, { note: 72, startBeat: 0.5, duration: 0.25 },
        { note: 74, startBeat: 0.75, duration: 0.25 }, { note: 72, startBeat: 1, duration: 0.25 },
        { note: 70, startBeat: 1.25, duration: 0.25 }, { note: 72, startBeat: 1.5, duration: 0.5 },
        { note: 72, startBeat: 2, duration: 0.25 }, { note: 72, startBeat: 2.5, duration: 0.25 },
        { note: 74, startBeat: 2.75, duration: 0.25 }, { note: 76, startBeat: 3, duration: 0.5 },
        { note: 74, startBeat: 3.5, duration: 0.25 }, { note: 72, startBeat: 4, duration: 0.5 },
        { note: 74, startBeat: 4.5, duration: 0.25 }, { note: 72, startBeat: 5, duration: 0.5 },
        { note: 70, startBeat: 5.5, duration: 0.25 }, { note: 69, startBeat: 6, duration: 0.75 },
        { note: 67, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [60, 60, 58, 58, 57, 57, 58, 58],
      arpPattern: [60, 64, 67, 64, 58, 62, 65, 62, 57, 60, 64, 60, 58, 61, 65, 61],
    }
  },
  {
    id: 'hiphop-2', name: 'Urban Flow', genre: 'Hip Hop', duration: '2:45',
    config: {
      bpm: 88, rootNote: 65,
      chordProgression: [[65, 69, 72], [63, 67, 70], [61, 65, 68], [63, 66, 70]],
      melodyNotes: [
        { note: 77, startBeat: 0, duration: 0.25 }, { note: 77, startBeat: 0.5, duration: 0.25 },
        { note: 76, startBeat: 0.75, duration: 0.25 }, { note: 74, startBeat: 1, duration: 0.5 },
        { note: 77, startBeat: 1.5, duration: 0.5 }, { note: 76, startBeat: 2, duration: 0.25 },
        { note: 74, startBeat: 2.5, duration: 0.25 }, { note: 72, startBeat: 2.75, duration: 0.25 },
        { note: 74, startBeat: 3, duration: 0.5 }, { note: 72, startBeat: 3.5, duration: 0.5 },
        { note: 70, startBeat: 4, duration: 0.5 }, { note: 69, startBeat: 5, duration: 0.5 },
        { note: 70, startBeat: 5.5, duration: 0.5 }, { note: 72, startBeat: 6, duration: 0.25 },
        { note: 74, startBeat: 6.25, duration: 0.25 }, { note: 72, startBeat: 6.5, duration: 0.5 },
        { note: 70, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [65, 65, 63, 63, 61, 61, 63, 63],
      arpPattern: [65, 69, 72, 69, 63, 67, 70, 67, 61, 65, 68, 65, 63, 66, 70, 66],
    }
  },
  {
    id: 'hiphop-3', name: 'Cypher', genre: 'Hip Hop', duration: '3:50',
    config: {
      bpm: 95, rootNote: 62,
      chordProgression: [[62, 66, 69], [60, 64, 67], [58, 62, 65], [57, 60, 64]],
      melodyNotes: [
        { note: 74, startBeat: 0, duration: 0.25 }, { note: 72, startBeat: 0.5, duration: 0.25 },
        { note: 74, startBeat: 0.75, duration: 0.25 }, { note: 76, startBeat: 1, duration: 0.25 },
        { note: 78, startBeat: 1.25, duration: 0.25 }, { note: 76, startBeat: 1.5, duration: 0.25 },
        { note: 74, startBeat: 2, duration: 0.5 }, { note: 72, startBeat: 2.5, duration: 0.5 },
        { note: 74, startBeat: 3, duration: 0.25 }, { note: 76, startBeat: 3.25, duration: 0.25 },
        { note: 74, startBeat: 3.5, duration: 0.5 }, { note: 72, startBeat: 4, duration: 0.5 },
        { note: 71, startBeat: 5, duration: 0.5 }, { note: 69, startBeat: 5.5, duration: 0.5 },
        { note: 72, startBeat: 6, duration: 0.5 }, { note: 71, startBeat: 6.5, duration: 0.5 },
        { note: 69, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [62, 62, 60, 60, 58, 58, 57, 57],
      arpPattern: [62, 66, 69, 66, 60, 64, 67, 64, 58, 62, 65, 62, 57, 60, 64, 60],
    }
  },
  {
    id: 'hiphop-4', name: 'Downtown', genre: 'Hip Hop', duration: '3:22',
    config: {
      bpm: 90, rootNote: 64,
      chordProgression: [[64, 68, 71], [62, 66, 69], [60, 64, 67], [62, 65, 69]],
      melodyNotes: [
        { note: 76, startBeat: 0, duration: 0.25 }, { note: 76, startBeat: 0.5, duration: 0.25 },
        { note: 74, startBeat: 0.75, duration: 0.25 }, { note: 72, startBeat: 1, duration: 0.5 },
        { note: 74, startBeat: 1.5, duration: 0.5 }, { note: 72, startBeat: 2, duration: 0.25 },
        { note: 71, startBeat: 2.5, duration: 0.25 }, { note: 72, startBeat: 2.75, duration: 0.25 },
        { note: 74, startBeat: 3, duration: 0.5 }, { note: 72, startBeat: 3.5, duration: 0.5 },
        { note: 71, startBeat: 4, duration: 0.5 }, { note: 69, startBeat: 5, duration: 0.5 },
        { note: 71, startBeat: 5.5, duration: 0.5 }, { note: 72, startBeat: 6, duration: 0.25 },
        { note: 74, startBeat: 6.25, duration: 0.25 }, { note: 72, startBeat: 6.5, duration: 0.5 },
        { note: 72, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [64, 64, 62, 62, 60, 60, 62, 62],
      arpPattern: [64, 68, 71, 68, 62, 66, 69, 66, 60, 64, 67, 64, 62, 65, 69, 65],
    }
  },
  {
    id: 'hiphop-5', name: 'Block Party', genre: 'Hip Hop', duration: '4:10',
    config: {
      bpm: 100, rootNote: 67,
      chordProgression: [[67, 71, 74], [65, 69, 72], [64, 68, 71], [62, 66, 69]],
      melodyNotes: [
        { note: 79, startBeat: 0, duration: 0.25 }, { note: 79, startBeat: 0.5, duration: 0.25 },
        { note: 78, startBeat: 0.75, duration: 0.25 }, { note: 76, startBeat: 1, duration: 0.25 },
        { note: 78, startBeat: 1.25, duration: 0.25 }, { note: 79, startBeat: 1.5, duration: 0.5 },
        { note: 78, startBeat: 2, duration: 0.25 }, { note: 76, startBeat: 2.5, duration: 0.25 },
        { note: 74, startBeat: 2.75, duration: 0.25 }, { note: 76, startBeat: 3, duration: 0.5 },
        { note: 78, startBeat: 3.5, duration: 0.5 }, { note: 76, startBeat: 4, duration: 0.5 },
        { note: 74, startBeat: 5, duration: 0.5 }, { note: 72, startBeat: 5.5, duration: 0.5 },
        { note: 74, startBeat: 6, duration: 0.5 }, { note: 72, startBeat: 6.5, duration: 0.5 },
        { note: 71, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [67, 67, 65, 65, 64, 64, 62, 62],
      arpPattern: [67, 71, 74, 71, 65, 69, 72, 69, 64, 68, 71, 68, 62, 66, 69, 66],
    }
  },
  {
    id: 'hiphop-6', name: 'Crown Heights', genre: 'Hip Hop', duration: '3:08',
    config: {
      bpm: 86, rootNote: 60,
      chordProgression: [[60, 64, 67], [59, 63, 66], [57, 61, 64], [59, 62, 66]],
      melodyNotes: [
        { note: 72, startBeat: 0, duration: 0.25 }, { note: 72, startBeat: 0.5, duration: 0.25 },
        { note: 71, startBeat: 0.75, duration: 0.25 }, { note: 69, startBeat: 1, duration: 0.25 },
        { note: 71, startBeat: 1.25, duration: 0.25 }, { note: 72, startBeat: 1.5, duration: 0.5 },
        { note: 71, startBeat: 2, duration: 0.25 }, { note: 69, startBeat: 2.5, duration: 0.25 },
        { note: 67, startBeat: 2.75, duration: 0.25 }, { note: 69, startBeat: 3, duration: 0.5 },
        { note: 71, startBeat: 3.5, duration: 0.5 }, { note: 69, startBeat: 4, duration: 0.5 },
        { note: 67, startBeat: 5, duration: 0.5 }, { note: 66, startBeat: 5.5, duration: 0.5 },
        { note: 67, startBeat: 6, duration: 0.5 }, { note: 66, startBeat: 6.5, duration: 0.5 },
        { note: 64, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [60, 60, 59, 59, 57, 57, 59, 59],
      arpPattern: [60, 64, 67, 64, 59, 63, 66, 63, 57, 61, 64, 61, 59, 62, 66, 62],
    }
  },

  // Acoustic
  {
    id: 'acoustic-1', name: 'Morning Light', genre: 'Acoustic', duration: '3:40',
    config: {
      bpm: 82, rootNote: 64,
      chordProgression: [[64, 68, 71], [62, 66, 69], [60, 64, 67], [62, 65, 69]],
      melodyNotes: [
        { note: 76, startBeat: 0, duration: 1 }, { note: 74, startBeat: 1, duration: 0.5 },
        { note: 72, startBeat: 1.5, duration: 0.5 }, { note: 74, startBeat: 2, duration: 1 },
        { note: 72, startBeat: 3, duration: 0.5 }, { note: 71, startBeat: 3.5, duration: 0.5 },
        { note: 69, startBeat: 4, duration: 1 }, { note: 71, startBeat: 5, duration: 0.5 },
        { note: 72, startBeat: 5.5, duration: 0.5 }, { note: 74, startBeat: 6, duration: 1 },
        { note: 72, startBeat: 7, duration: 1 },
      ],
      bassPattern: [64, 62, 60, 62],
      arpPattern: [64, 68, 71, 68, 62, 66, 69, 66, 60, 64, 67, 64, 62, 65, 69, 65],
    }
  },
  {
    id: 'acoustic-2', name: 'Campfire', genre: 'Acoustic', duration: '4:15',
    config: {
      bpm: 76, rootNote: 67,
      chordProgression: [[67, 71, 74], [65, 69, 72], [64, 67, 71], [62, 66, 69]],
      melodyNotes: [
        { note: 79, startBeat: 0, duration: 0.75 }, { note: 78, startBeat: 0.75, duration: 0.25 },
        { note: 76, startBeat: 1, duration: 0.5 }, { note: 78, startBeat: 1.5, duration: 0.5 },
        { note: 79, startBeat: 2, duration: 1 }, { note: 78, startBeat: 3, duration: 0.5 },
        { note: 76, startBeat: 3.5, duration: 0.5 }, { note: 74, startBeat: 4, duration: 0.5 },
        { note: 76, startBeat: 4.5, duration: 0.5 }, { note: 78, startBeat: 5, duration: 1 },
        { note: 76, startBeat: 6, duration: 0.5 }, { note: 74, startBeat: 6.5, duration: 0.5 },
        { note: 72, startBeat: 7, duration: 1 },
      ],
      bassPattern: [67, 65, 64, 62],
      arpPattern: [67, 71, 74, 71, 65, 69, 72, 69, 64, 67, 71, 67, 62, 66, 69, 66],
    }
  },
  {
    id: 'acoustic-3', name: 'Open Road', genre: 'Acoustic', duration: '3:55',
    config: {
      bpm: 84, rootNote: 69,
      chordProgression: [[69, 73, 76], [67, 71, 74], [65, 69, 72], [64, 68, 71]],
      melodyNotes: [
        { note: 81, startBeat: 0, duration: 0.5 }, { note: 80, startBeat: 0.5, duration: 0.5 },
        { note: 79, startBeat: 1, duration: 0.5 }, { note: 80, startBeat: 1.5, duration: 0.5 },
        { note: 81, startBeat: 2, duration: 0.75 }, { note: 79, startBeat: 2.75, duration: 0.25 },
        { note: 78, startBeat: 3, duration: 0.5 }, { note: 76, startBeat: 3.5, duration: 0.5 },
        { note: 78, startBeat: 4, duration: 1 }, { note: 76, startBeat: 5, duration: 0.5 },
        { note: 74, startBeat: 5.5, duration: 0.5 }, { note: 73, startBeat: 6, duration: 1 },
        { note: 71, startBeat: 7, duration: 1 },
      ],
      bassPattern: [69, 67, 65, 64],
      arpPattern: [69, 73, 76, 73, 67, 71, 74, 71, 65, 69, 72, 69, 64, 68, 71, 68],
    }
  },
  {
    id: 'acoustic-4', name: 'Sunny Day', genre: 'Acoustic', duration: '3:20',
    config: {
      bpm: 90, rootNote: 65,
      chordProgression: [[65, 69, 72], [67, 70, 74], [64, 68, 71], [62, 66, 69]],
      melodyNotes: [
        { note: 77, startBeat: 0, duration: 0.5 }, { note: 76, startBeat: 0.5, duration: 0.5 },
        { note: 74, startBeat: 1, duration: 0.5 }, { note: 76, startBeat: 1.5, duration: 0.5 },
        { note: 77, startBeat: 2, duration: 0.75 }, { note: 76, startBeat: 2.75, duration: 0.25 },
        { note: 74, startBeat: 3, duration: 0.5 }, { note: 72, startBeat: 3.5, duration: 0.5 },
        { note: 74, startBeat: 4, duration: 0.5 }, { note: 76, startBeat: 4.5, duration: 0.5 },
        { note: 77, startBeat: 5, duration: 0.5 }, { note: 76, startBeat: 5.5, duration: 0.5 },
        { note: 74, startBeat: 6, duration: 1 }, { note: 72, startBeat: 7, duration: 1 },
      ],
      bassPattern: [65, 67, 64, 62],
      arpPattern: [65, 69, 72, 69, 67, 70, 74, 70, 64, 68, 71, 68, 62, 66, 69, 66],
    }
  },
  {
    id: 'acoustic-5', name: 'Autumn Leaves', genre: 'Acoustic', duration: '4:30',
    config: {
      bpm: 72, rootNote: 64,
      chordProgression: [[64, 67, 71], [62, 66, 69], [60, 64, 67], [59, 63, 66]],
      melodyNotes: [
        { note: 76, startBeat: 0, duration: 1 }, { note: 74, startBeat: 1, duration: 0.75 },
        { note: 72, startBeat: 1.75, duration: 0.25 }, { note: 74, startBeat: 2, duration: 0.5 },
        { note: 72, startBeat: 2.5, duration: 0.5 }, { note: 71, startBeat: 3, duration: 1 },
        { note: 69, startBeat: 4, duration: 0.5 }, { note: 71, startBeat: 4.5, duration: 0.5 },
        { note: 72, startBeat: 5, duration: 0.5 }, { note: 74, startBeat: 5.5, duration: 0.5 },
        { note: 72, startBeat: 6, duration: 0.5 }, { note: 71, startBeat: 6.5, duration: 0.5 },
        { note: 69, startBeat: 7, duration: 1 },
      ],
      bassPattern: [64, 62, 60, 59],
      arpPattern: [64, 67, 71, 67, 62, 66, 69, 66, 60, 64, 67, 64, 59, 63, 66, 63],
    }
  },
  {
    id: 'acoustic-6', name: 'Gentle Breeze', genre: 'Acoustic', duration: '3:05',
    config: {
      bpm: 78, rootNote: 65,
      chordProgression: [[65, 69, 72], [63, 67, 70], [61, 65, 68], [63, 66, 70]],
      melodyNotes: [
        { note: 77, startBeat: 0, duration: 0.5 }, { note: 76, startBeat: 0.5, duration: 0.5 },
        { note: 74, startBeat: 1, duration: 0.5 }, { note: 76, startBeat: 1.5, duration: 0.5 },
        { note: 74, startBeat: 2, duration: 1 }, { note: 72, startBeat: 3, duration: 0.5 },
        { note: 74, startBeat: 3.5, duration: 0.5 }, { note: 76, startBeat: 4, duration: 0.5 },
        { note: 74, startBeat: 4.5, duration: 0.5 }, { note: 72, startBeat: 5, duration: 0.5 },
        { note: 71, startBeat: 5.5, duration: 0.5 }, { note: 69, startBeat: 6, duration: 1 },
        { note: 67, startBeat: 7, duration: 1 },
      ],
      bassPattern: [65, 63, 61, 63],
      arpPattern: [65, 69, 72, 69, 63, 67, 70, 67, 61, 65, 68, 65, 63, 66, 70, 66],
    }
  },

  // Electronic
  {
    id: 'electronic-1', name: 'Neon Nights', genre: 'Electronic', duration: '4:20',
    config: {
      bpm: 128, rootNote: 60,
      chordProgression: [[60, 64, 67], [58, 62, 65], [57, 60, 64], [58, 61, 65]],
      melodyNotes: [
        { note: 72, startBeat: 0, duration: 0.5 }, { note: 74, startBeat: 1, duration: 0.5 },
        { note: 76, startBeat: 2, duration: 0.5 }, { note: 74, startBeat: 3, duration: 0.25 },
        { note: 72, startBeat: 3.25, duration: 0.25 }, { note: 74, startBeat: 3.5, duration: 0.5 },
        { note: 72, startBeat: 4, duration: 0.5 }, { note: 70, startBeat: 5, duration: 0.5 },
        { note: 72, startBeat: 6, duration: 0.5 }, { note: 74, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [60, 58, 57, 58],
      arpPattern: [60, 47, 64, 47, 67, 47, 64, 47, 58, 47, 62, 47, 65, 47, 62, 47],
    }
  },
  {
    id: 'electronic-2', name: 'Digital Dreams', genre: 'Electronic', duration: '3:45',
    config: {
      bpm: 120, rootNote: 65,
      chordProgression: [[65, 69, 72], [63, 67, 70], [61, 65, 68], [63, 66, 70]],
      melodyNotes: [
        { note: 77, startBeat: 0, duration: 0.25 }, { note: 76, startBeat: 0.5, duration: 0.25 },
        { note: 77, startBeat: 0.75, duration: 0.25 }, { note: 79, startBeat: 1, duration: 0.25 },
        { note: 81, startBeat: 1.25, duration: 0.25 }, { note: 79, startBeat: 1.5, duration: 0.25 },
        { note: 77, startBeat: 2, duration: 0.5 }, { note: 76, startBeat: 2.5, duration: 0.5 },
        { note: 74, startBeat: 3, duration: 0.5 }, { note: 76, startBeat: 3.5, duration: 0.5 },
        { note: 77, startBeat: 4, duration: 0.5 }, { note: 76, startBeat: 5, duration: 0.5 },
        { note: 74, startBeat: 5.5, duration: 0.5 }, { note: 76, startBeat: 6, duration: 0.5 },
        { note: 77, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [65, 63, 61, 63],
      arpPattern: [65, 52, 69, 52, 72, 52, 69, 52, 63, 50, 67, 50, 70, 50, 67, 50],
    }
  },
  {
    id: 'electronic-3', name: 'Pulse', genre: 'Electronic', duration: '3:30',
    config: {
      bpm: 132, rootNote: 67,
      chordProgression: [[67, 71, 74], [65, 69, 72], [64, 68, 71], [62, 66, 69]],
      melodyNotes: [
        { note: 79, startBeat: 0, duration: 0.25 }, { note: 79, startBeat: 0.5, duration: 0.25 },
        { note: 81, startBeat: 1, duration: 0.25 }, { note: 79, startBeat: 1.5, duration: 0.25 },
        { note: 78, startBeat: 2, duration: 0.5 }, { note: 79, startBeat: 2.5, duration: 0.5 },
        { note: 78, startBeat: 3, duration: 0.25 }, { note: 76, startBeat: 3.5, duration: 0.25 },
        { note: 78, startBeat: 4, duration: 0.5 }, { note: 76, startBeat: 5, duration: 0.5 },
        { note: 74, startBeat: 5.5, duration: 0.5 }, { note: 76, startBeat: 6, duration: 0.5 },
        { note: 74, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [67, 65, 64, 62],
      arpPattern: [67, 53, 71, 53, 74, 53, 71, 53, 65, 52, 69, 52, 72, 52, 69, 52],
    }
  },
  {
    id: 'electronic-4', name: 'Circuit', genre: 'Electronic', duration: '4:00',
    config: {
      bpm: 125, rootNote: 62,
      chordProgression: [[62, 66, 69], [60, 64, 67], [58, 62, 65], [60, 63, 67]],
      melodyNotes: [
        { note: 74, startBeat: 0, duration: 0.25 }, { note: 73, startBeat: 0.5, duration: 0.25 },
        { note: 74, startBeat: 0.75, duration: 0.25 }, { note: 76, startBeat: 1, duration: 0.25 },
        { note: 78, startBeat: 1.25, duration: 0.25 }, { note: 76, startBeat: 1.5, duration: 0.5 },
        { note: 74, startBeat: 2, duration: 0.25 }, { note: 73, startBeat: 2.5, duration: 0.25 },
        { note: 74, startBeat: 2.75, duration: 0.25 }, { note: 76, startBeat: 3, duration: 0.5 },
        { note: 74, startBeat: 3.5, duration: 0.5 }, { note: 73, startBeat: 4, duration: 0.5 },
        { note: 71, startBeat: 5, duration: 0.5 }, { note: 73, startBeat: 5.5, duration: 0.5 },
        { note: 74, startBeat: 6, duration: 0.5 }, { note: 73, startBeat: 6.5, duration: 0.5 },
        { note: 71, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [62, 60, 58, 60],
      arpPattern: [62, 49, 66, 49, 69, 49, 66, 49, 60, 48, 64, 48, 67, 48, 64, 48],
    }
  },
  {
    id: 'electronic-5', name: 'Synthwave', genre: 'Electronic', duration: '3:55',
    config: {
      bpm: 110, rootNote: 64,
      chordProgression: [[64, 68, 71], [62, 66, 69], [60, 64, 67], [62, 65, 69]],
      melodyNotes: [
        { note: 76, startBeat: 0, duration: 0.75 }, { note: 74, startBeat: 0.75, duration: 0.25 },
        { note: 76, startBeat: 1, duration: 0.5 }, { note: 78, startBeat: 1.5, duration: 0.5 },
        { note: 79, startBeat: 2, duration: 0.5 }, { note: 78, startBeat: 2.5, duration: 0.5 },
        { note: 76, startBeat: 3, duration: 1 }, { note: 74, startBeat: 4, duration: 0.5 },
        { note: 76, startBeat: 4.5, duration: 0.5 }, { note: 78, startBeat: 5, duration: 0.5 },
        { note: 79, startBeat: 5.5, duration: 0.5 }, { note: 78, startBeat: 6, duration: 0.5 },
        { note: 76, startBeat: 6.5, duration: 0.5 }, { note: 74, startBeat: 7, duration: 1 },
      ],
      bassPattern: [64, 62, 60, 62],
      arpPattern: [64, 50, 68, 50, 71, 50, 68, 50, 62, 49, 66, 49, 69, 49, 66, 49],
    }
  },
  {
    id: 'electronic-6', name: 'Deep Space', genre: 'Electronic', duration: '5:10',
    config: {
      bpm: 115, rootNote: 69,
      chordProgression: [[69, 73, 76], [67, 71, 74], [65, 69, 72], [64, 68, 71]],
      melodyNotes: [
        { note: 81, startBeat: 0, duration: 0.25 }, { note: 80, startBeat: 0.25, duration: 0.25 },
        { note: 81, startBeat: 0.75, duration: 0.25 }, { note: 83, startBeat: 1, duration: 0.25 },
        { note: 85, startBeat: 1.25, duration: 0.25 }, { note: 83, startBeat: 1.5, duration: 0.25 },
        { note: 81, startBeat: 2, duration: 0.5 }, { note: 80, startBeat: 2.5, duration: 0.25 },
        { note: 81, startBeat: 2.75, duration: 0.25 }, { note: 83, startBeat: 3, duration: 0.5 },
        { note: 81, startBeat: 3.5, duration: 0.5 }, { note: 80, startBeat: 4, duration: 0.5 },
        { note: 78, startBeat: 5, duration: 0.5 }, { note: 80, startBeat: 5.5, duration: 0.5 },
        { note: 81, startBeat: 6, duration: 0.5 }, { note: 83, startBeat: 6.5, duration: 0.5 },
        { note: 81, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [69, 67, 65, 64],
      arpPattern: [69, 55, 73, 55, 76, 55, 73, 55, 67, 54, 71, 54, 74, 54, 71, 54],
    }
  },

  // Cinematic
  {
    id: 'cinematic-1', name: 'Epic Rise', genre: 'Cinematic', duration: '3:30',
    config: {
      bpm: 80, rootNote: 60,
      chordProgression: [[60, 64, 67, 72], [62, 67, 71, 76], [64, 68, 72, 77], [67, 71, 74, 79]],
      melodyNotes: [
        { note: 76, startBeat: 0, duration: 2 }, { note: 79, startBeat: 2, duration: 2 },
        { note: 83, startBeat: 4, duration: 2 }, { note: 86, startBeat: 6, duration: 2 },
      ],
      bassPattern: [60, 62, 64, 67],
      arpPattern: [60, 64, 67, 72, 64, 67, 72, 76, 62, 67, 71, 76, 67, 71, 76, 79],
    }
  },
  {
    id: 'cinematic-2', name: 'Mountain Peak', genre: 'Cinematic', duration: '4:05',
    config: {
      bpm: 76, rootNote: 65,
      chordProgression: [[65, 69, 72, 77], [67, 71, 74, 79], [64, 68, 72, 76], [62, 66, 69, 74]],
      melodyNotes: [
        { note: 81, startBeat: 0, duration: 1.5 }, { note: 84, startBeat: 1.5, duration: 0.5 },
        { note: 86, startBeat: 2, duration: 2 }, { note: 88, startBeat: 4, duration: 1.5 },
        { note: 86, startBeat: 5.5, duration: 0.5 }, { note: 84, startBeat: 6, duration: 1 },
        { note: 81, startBeat: 7, duration: 1 },
      ],
      bassPattern: [65, 67, 64, 62],
      arpPattern: [65, 69, 72, 77, 69, 72, 77, 79, 67, 71, 74, 79, 71, 74, 79, 81],
    }
  },
  {
    id: 'cinematic-3', name: 'Journey', genre: 'Cinematic', duration: '3:50',
    config: {
      bpm: 72, rootNote: 64,
      chordProgression: [[64, 68, 71, 76], [62, 66, 69, 74], [60, 64, 68, 72], [62, 65, 69, 73]],
      melodyNotes: [
        { note: 79, startBeat: 0, duration: 1.5 }, { note: 81, startBeat: 1.5, duration: 0.5 },
        { note: 83, startBeat: 2, duration: 1.5 }, { note: 84, startBeat: 3.5, duration: 0.5 },
        { note: 86, startBeat: 4, duration: 2 }, { note: 84, startBeat: 6, duration: 1 },
        { note: 83, startBeat: 7, duration: 1 },
      ],
      bassPattern: [64, 62, 60, 62],
      arpPattern: [64, 68, 71, 76, 68, 71, 76, 79, 62, 66, 69, 74, 66, 69, 74, 77],
    }
  },
  {
    id: 'cinematic-4', name: 'Victory', genre: 'Cinematic', duration: '3:15',
    config: {
      bpm: 85, rootNote: 67,
      chordProgression: [[67, 71, 74, 79], [65, 69, 72, 77], [64, 68, 71, 76], [62, 66, 70, 74]],
      melodyNotes: [
        { note: 83, startBeat: 0, duration: 0.75 }, { note: 84, startBeat: 0.75, duration: 0.25 },
        { note: 86, startBeat: 1, duration: 1 }, { note: 88, startBeat: 2, duration: 1 },
        { note: 91, startBeat: 3, duration: 2 }, { note: 88, startBeat: 5, duration: 1 },
        { note: 86, startBeat: 6, duration: 1 }, { note: 84, startBeat: 7, duration: 1 },
      ],
      bassPattern: [67, 65, 64, 62],
      arpPattern: [67, 71, 74, 79, 71, 74, 79, 83, 65, 69, 72, 77, 69, 72, 77, 81],
    }
  },
  {
    id: 'cinematic-5', name: 'Wide Lens', genre: 'Cinematic', duration: '4:25',
    config: {
      bpm: 70, rootNote: 64,
      chordProgression: [[64, 68, 72, 77], [66, 70, 73, 78], [68, 72, 75, 79], [67, 71, 74, 78]],
      melodyNotes: [
        { note: 81, startBeat: 0, duration: 2 }, { note: 84, startBeat: 2, duration: 1 },
        { note: 86, startBeat: 3, duration: 2 }, { note: 88, startBeat: 5, duration: 1 },
        { note: 86, startBeat: 6, duration: 1 }, { note: 84, startBeat: 7, duration: 1 },
      ],
      bassPattern: [64, 66, 68, 67],
      arpPattern: [64, 68, 72, 77, 68, 72, 77, 81, 66, 70, 73, 78, 70, 73, 78, 82],
    }
  },
  {
    id: 'cinematic-6', name: 'Orchestral Swell', genre: 'Cinematic', duration: '4:40',
    config: {
      bpm: 65, rootNote: 62,
      chordProgression: [[62, 66, 69, 74], [60, 64, 67, 72], [58, 62, 66, 70], [57, 61, 64, 69]],
      melodyNotes: [
        { note: 79, startBeat: 0, duration: 2 }, { note: 81, startBeat: 2, duration: 1.5 },
        { note: 83, startBeat: 3.5, duration: 0.5 }, { note: 86, startBeat: 4, duration: 2 },
        { note: 84, startBeat: 6, duration: 1 }, { note: 83, startBeat: 7, duration: 1 },
      ],
      bassPattern: [62, 60, 58, 57],
      arpPattern: [62, 66, 69, 74, 66, 69, 74, 79, 60, 64, 67, 72, 64, 67, 72, 77],
    }
  },

  // Jazz
  {
    id: 'jazz-1', name: 'Blue Note', genre: 'Jazz', duration: '4:10',
    config: {
      bpm: 100, rootNote: 62,
      chordProgression: [[62, 66, 69], [64, 68, 71], [62, 65, 69], [60, 64, 67]],
      melodyNotes: [
        { note: 74, startBeat: 0, duration: 0.5 }, { note: 73, startBeat: 0.5, duration: 0.5 },
        { note: 74, startBeat: 1, duration: 0.25 }, { note: 76, startBeat: 1.25, duration: 0.25 },
        { note: 74, startBeat: 1.5, duration: 0.5 }, { note: 73, startBeat: 2, duration: 0.75 },
        { note: 71, startBeat: 2.75, duration: 0.25 }, { note: 69, startBeat: 3, duration: 0.5 },
        { note: 71, startBeat: 3.5, duration: 0.5 }, { note: 73, startBeat: 4, duration: 0.5 },
        { note: 74, startBeat: 4.5, duration: 0.25 }, { note: 73, startBeat: 4.75, duration: 0.25 },
        { note: 71, startBeat: 5, duration: 0.5 }, { note: 69, startBeat: 5.5, duration: 0.5 },
        { note: 68, startBeat: 6, duration: 0.5 }, { note: 66, startBeat: 6.5, duration: 0.5 },
        { note: 64, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [62, 64, 62, 60],
      arpPattern: [62, 66, 69, 66, 64, 68, 71, 68, 62, 65, 69, 65, 60, 64, 67, 64],
    }
  },
  {
    id: 'jazz-2', name: 'Late Night (Jazz)', genre: 'Jazz', duration: '3:55',
    config: {
      bpm: 95, rootNote: 67,
      chordProgression: [[67, 71, 74], [65, 69, 72], [64, 67, 71], [62, 66, 69]],
      melodyNotes: [
        { note: 79, startBeat: 0, duration: 0.25 }, { note: 78, startBeat: 0.5, duration: 0.25 },
        { note: 79, startBeat: 0.75, duration: 0.25 }, { note: 81, startBeat: 1, duration: 0.5 },
        { note: 79, startBeat: 1.5, duration: 0.5 }, { note: 78, startBeat: 2, duration: 0.5 },
        { note: 76, startBeat: 2.5, duration: 0.5 }, { note: 78, startBeat: 3, duration: 0.5 },
        { note: 79, startBeat: 3.5, duration: 0.5 }, { note: 78, startBeat: 4, duration: 0.5 },
        { note: 76, startBeat: 4.5, duration: 0.5 }, { note: 74, startBeat: 5, duration: 0.5 },
        { note: 73, startBeat: 5.5, duration: 0.5 }, { note: 74, startBeat: 6, duration: 0.75 },
        { note: 73, startBeat: 6.75, duration: 0.25 }, { note: 71, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [67, 65, 64, 62],
      arpPattern: [67, 71, 74, 71, 65, 69, 72, 69, 64, 67, 71, 67, 62, 66, 69, 66],
    }
  },
  {
    id: 'jazz-3', name: 'Smooth Groove', genre: 'Jazz', duration: '3:40',
    config: {
      bpm: 90, rootNote: 64,
      chordProgression: [[64, 68, 71], [62, 66, 69], [60, 64, 67], [62, 65, 69]],
      melodyNotes: [
        { note: 76, startBeat: 0, duration: 0.5 }, { note: 74, startBeat: 0.5, duration: 0.5 },
        { note: 72, startBeat: 1, duration: 0.25 }, { note: 74, startBeat: 1.25, duration: 0.25 },
        { note: 76, startBeat: 1.5, duration: 0.5 }, { note: 74, startBeat: 2, duration: 0.5 },
        { note: 72, startBeat: 2.5, duration: 0.5 }, { note: 71, startBeat: 3, duration: 0.5 },
        { note: 69, startBeat: 3.5, duration: 0.5 }, { note: 71, startBeat: 4, duration: 0.5 },
        { note: 72, startBeat: 4.5, duration: 0.25 }, { note: 74, startBeat: 4.75, duration: 0.25 },
        { note: 72, startBeat: 5, duration: 0.5 }, { note: 71, startBeat: 5.5, duration: 0.5 },
        { note: 69, startBeat: 6, duration: 0.5 }, { note: 67, startBeat: 6.5, duration: 0.5 },
        { note: 66, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [64, 62, 60, 62],
      arpPattern: [64, 68, 71, 68, 62, 66, 69, 66, 60, 64, 67, 64, 62, 65, 69, 65],
    }
  },
  {
    id: 'jazz-4', name: 'Swing Time', genre: 'Jazz', duration: '3:25',
    config: {
      bpm: 110, rootNote: 62,
      chordProgression: [[62, 66, 69], [60, 64, 67], [58, 62, 65], [60, 63, 67]],
      melodyNotes: [
        { note: 74, startBeat: 0, duration: 0.25 }, { note: 72, startBeat: 0.5, duration: 0.25 },
        { note: 74, startBeat: 0.75, duration: 0.25 }, { note: 76, startBeat: 1, duration: 0.25 },
        { note: 77, startBeat: 1.25, duration: 0.25 }, { note: 76, startBeat: 1.5, duration: 0.25 },
        { note: 74, startBeat: 2, duration: 0.5 }, { note: 72, startBeat: 2.5, duration: 0.5 },
        { note: 74, startBeat: 3, duration: 0.5 }, { note: 72, startBeat: 3.5, duration: 0.25 },
        { note: 71, startBeat: 3.75, duration: 0.25 }, { note: 69, startBeat: 4, duration: 0.5 },
        { note: 71, startBeat: 4.5, duration: 0.5 }, { note: 72, startBeat: 5, duration: 0.5 },
        { note: 74, startBeat: 5.5, duration: 0.5 }, { note: 72, startBeat: 6, duration: 0.5 },
        { note: 71, startBeat: 6.5, duration: 0.5 }, { note: 69, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [62, 60, 58, 60],
      arpPattern: [62, 66, 69, 66, 60, 64, 67, 64, 58, 62, 65, 62, 60, 63, 67, 63],
    }
  },
  {
    id: 'jazz-5', name: 'Bossa Nova', genre: 'Jazz', duration: '4:00',
    config: {
      bpm: 105, rootNote: 65,
      chordProgression: [[65, 69, 72], [63, 67, 70], [61, 65, 68], [63, 66, 70]],
      melodyNotes: [
        { note: 77, startBeat: 0, duration: 0.5 }, { note: 76, startBeat: 0.5, duration: 0.5 },
        { note: 74, startBeat: 1, duration: 0.5 }, { note: 76, startBeat: 1.5, duration: 0.5 },
        { note: 74, startBeat: 2, duration: 0.75 }, { note: 73, startBeat: 2.75, duration: 0.25 },
        { note: 74, startBeat: 3, duration: 0.5 }, { note: 76, startBeat: 3.5, duration: 0.5 },
        { note: 74, startBeat: 4, duration: 0.5 }, { note: 72, startBeat: 4.5, duration: 0.5 },
        { note: 74, startBeat: 5, duration: 0.25 }, { note: 76, startBeat: 5.25, duration: 0.25 },
        { note: 74, startBeat: 5.5, duration: 0.5 }, { note: 72, startBeat: 6, duration: 0.5 },
        { note: 71, startBeat: 6.5, duration: 0.5 }, { note: 69, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [65, 63, 61, 63],
      arpPattern: [65, 69, 72, 69, 63, 67, 70, 67, 61, 65, 68, 65, 63, 66, 70, 66],
    }
  },
  {
    id: 'jazz-6', name: 'Jazz Club', genre: 'Jazz', duration: '5:15',
    config: {
      bpm: 98, rootNote: 60,
      chordProgression: [[60, 64, 67], [58, 62, 65], [57, 61, 64], [59, 63, 66]],
      melodyNotes: [
        { note: 72, startBeat: 0, duration: 0.25 }, { note: 71, startBeat: 0.25, duration: 0.25 },
        { note: 72, startBeat: 0.75, duration: 0.25 }, { note: 74, startBeat: 1, duration: 0.5 },
        { note: 72, startBeat: 1.5, duration: 0.5 }, { note: 71, startBeat: 2, duration: 0.5 },
        { note: 69, startBeat: 2.5, duration: 0.5 }, { note: 71, startBeat: 3, duration: 0.5 },
        { note: 72, startBeat: 3.5, duration: 0.5 }, { note: 71, startBeat: 4, duration: 0.5 },
        { note: 69, startBeat: 4.5, duration: 0.5 }, { note: 67, startBeat: 5, duration: 0.5 },
        { note: 66, startBeat: 5.5, duration: 0.5 }, { note: 67, startBeat: 6, duration: 0.5 },
        { note: 69, startBeat: 6.5, duration: 0.5 }, { note: 71, startBeat: 7, duration: 0.5 },
      ],
      bassPattern: [60, 58, 57, 59],
      arpPattern: [60, 64, 67, 64, 58, 62, 65, 62, 57, 61, 64, 61, 59, 63, 66, 63],
    }
  },
]

export const GENRES = Array.from(new Set(MUSIC_LIBRARY.map(t => t.genre)))

/**
 * Generate real audio for a music track using Web Audio API.
 * Creates a blob URL for the generated audio.
 */
export function generateTrackAudio(track: MusicLibraryTrack, sampleRate = 44100): string {
  const config = track.config
  if (!config) {
    // Fallback: generate a simple tone if no config exists
    return generateFallbackAudio(track.id, sampleRate)
  }

  const beatsPerSecond = config.bpm / 60
  const beatDuration = 1 / beatsPerSecond
  const totalBeats = 32 // Generate ~4 bars (enough for a preview)
  const totalDuration = totalBeats * beatDuration
  const totalSamples = Math.floor(totalDuration * sampleRate)

  // Create audio buffer
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)

  // Helper: MIDI note to frequency
  const midiToFreq = (note: number): number => 440 * Math.pow(2, (note - 69) / 12)

  // Helper: apply envelope
  const envelope = (t: number, noteStart: number, noteDur: number): number => {
    const rel = t - noteStart
    if (rel < 0 || rel > noteDur) return 0
    const attack = Math.min(1, rel * 20) // 50ms attack
    const release = Math.min(1, (noteDur - rel) * 10) // 100ms release
    return Math.min(attack, release)
  }

  // Generate chord pad (sustained chords)
  const chordDuration = beatDuration * 4 // One chord per 4 beats
  for (let chordIdx = 0; chordIdx < config.chordProgression.length; chordIdx++) {
    const chord = config.chordProgression[chordIdx]
    const chordStart = chordIdx * chordDuration
    const chordEnd = chordStart + chordDuration

    for (let noteIdx = 0; noteIdx < chord.length; noteIdx++) {
      const freq = midiToFreq(chord[noteIdx])
      for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate
        if (t >= chordStart && t < chordEnd) {
          const env = Math.min(1, (t - chordStart) * 5) * Math.min(1, (chordEnd - t) * 2)
          const osc = Math.sin(2 * Math.PI * freq * t) * 0.08 * env
          // Add some stereo width
          const pan = (noteIdx / (chord.length - 1)) * 0.6 - 0.3
          leftChannel[i] += osc * (1 - Math.abs(pan))
          rightChannel[i] += osc * (1 - Math.abs(-pan))
        }
      }
    }
  }

  // Generate melody (lead line)
  for (const note of config.melodyNotes) {
    const freq = midiToFreq(note.note)
    // Different waveform for melody (triangle-ish via sine shaping)
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate
      const noteStart = note.startBeat * beatDuration
      const noteDur = note.duration * beatDuration

      if (t >= noteStart && t < noteStart + noteDur) {
        const env = envelope(t, noteStart, noteDur) * 0.5
        // Triangle wave approximation
        const phase = (t - noteStart) * freq
        const phaseMod = (phase % 1) * 2 - 1
        const tri = Math.abs(phaseMod) * 2 - 1
        const sample = tri * 0.12 * env
        // Melody panned center
        leftChannel[i] += sample
        rightChannel[i] += sample
      }
    }
  }

  // Generate bass
  const bassNotesPerChord = 2
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate
    const chordIdx = Math.min(Math.floor((t / chordDuration) % config.chordProgression.length), config.bassPattern.length - 1)
    const bassNote = config.bassPattern[Math.min(chordIdx, config.bassPattern.length - 1)]
    const bassFreq = midiToFreq(bassNote - 12) // Octave lower

    // Sine wave bass with slight saturation
    const env = Math.max(0, Math.min(1, (t % chordDuration) * 20)) * Math.min(1, (chordDuration - (t % chordDuration)) * 2)
    const sample = Math.sin(2 * Math.PI * bassFreq * t) * 0.15 * env
    leftChannel[i] += sample * 0.7
    rightChannel[i] += sample * 0.7
  }

  // Generate arpeggio
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate
    const arpIdx = Math.floor((t / (beatDuration / 2))) % config.arpPattern.length
    const arpNote = config.arpPattern[arpIdx]
    const freq = midiToFreq(arpNote)
    const arpPhase = (t * config.bpm / 60 * 2) % 1

    if (arpPhase < 0.2) { // Short pluck
      const pluckEnv = Math.max(0, 1 - (t % (beatDuration / 2)) * 30)
      const sample = Math.sin(2 * Math.PI * freq * t * 2) * 0.04 * pluckEnv // Harmonic shimmer
      leftChannel[i] += sample * 0.5
      rightChannel[i] += sample * 0.5
    }
  }

  // Add subtle kick drum on every beat
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate
    const beatPhase = (t * config.bpm / 60) % 1
    if (beatPhase < 0.05) {
      const kickEnv = Math.max(0, 1 - (t % beatDuration) * 30)
      // Low frequency thump
      const kickFreq = 80 * Math.max(0.05, 1 - (t % beatDuration) * 20)
      const kickSample = Math.sin(2 * Math.PI * kickFreq * (t % beatDuration)) * 0.12 * kickEnv
      leftChannel[i] += kickSample
      rightChannel[i] += kickSample
    }
  }

  // Add hi-hat on off-beats
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate
    const hatPhase = (t * config.bpm / 60 * 2) % 1
    if (hatPhase < 0.02) {
      const hatEnv = Math.max(0, 1 - (t % (beatDuration / 2)) * 100)
      const hatNoise = Math.sin(2 * Math.PI * 8000 * t) + Math.sin(2 * Math.PI * 12000 * t)
      const hatSample = hatNoise * 0.03 * hatEnv
      leftChannel[i] += hatSample
      rightChannel[i] += hatSample
    }
  }

  // Normalize to prevent clipping
  let maxAbs = 0
  for (let i = 0; i < totalSamples; i++) {
    maxAbs = Math.max(maxAbs, Math.abs(leftChannel[i]), Math.abs(rightChannel[i]))
  }
  if (maxAbs > 1) {
    const norm = 0.9 / maxAbs
    for (let i = 0; i < totalSamples; i++) {
      leftChannel[i] *= norm
      rightChannel[i] *= norm
    }
  }

  // Convert AudioBuffer to WAV blob URL
  const wavUrl = audioBufferToWavUrl(buffer, sampleRate)
  audioCtx.close()
  return wavUrl
}

function generateFallbackAudio(trackId: string, sampleRate: number): string {
  const hash = trackId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const baseFreq = 220 + (hash % 88)
  const totalDuration = 3
  const totalSamples = Math.floor(totalDuration * sampleRate)

  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate)
  const left = buffer.getChannelData(0)
  const right = buffer.getChannelData(1)

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate
    const env = Math.min(1, t * 5) * Math.min(1, (totalDuration - t) * 3)
    const lfo = Math.sin(2 * Math.PI * 3 * t) * 0.5 + 0.5

    // Layered oscillators
    const osc1 = Math.sin(2 * Math.PI * baseFreq * t)
    const osc2 = Math.sin(2 * Math.PI * baseFreq * 1.5 * t) * 0.3
    const osc3 = Math.sin(2 * Math.PI * baseFreq * 2 * t) * 0.15

    const sample = (osc1 + osc2 + osc3) * 0.25 * env * lfo
    const spread = 0.2 + lfo * 0.2
    left[i] = sample * (1 - spread)
    right[i] = sample * (1 + spread)
  }

  const url = audioBufferToWavUrl(buffer, sampleRate)
  audioCtx.close()
  return url
}

function audioBufferToWavUrl(buffer: AudioBuffer, sampleRate: number): string {
  const length = buffer.length
  const numChannels = buffer.numberOfChannels
  const byteRate = sampleRate * numChannels * 2
  const blockAlign = numChannels * 2
  const dataSize = length * numChannels * 2

  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]))
      view.setInt16(offset, sample * 0x7FFF, true)
      offset += 2
    }
  }

  const blob = new Blob([arrayBuffer], { type: 'audio/wav' })
  return URL.createObjectURL(blob)
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
