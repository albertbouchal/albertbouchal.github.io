/* Travel write-ups — add an entry here when a country write-up is ready.
   Key must match the data-slug on the <path> in world-map.svg.
   Once an entry exists, the country pill in the visited list becomes a link
   and clicking the country on the map navigates here.

   Schema:
   'slug': {
     name:     'Country Name',          // display name
     flag:     '🏳',                    // emoji flag
     meta:     'One-liner / years',     // shown beneath the heading in monospace
     sections: [                        // one or more prose sections
       { heading: 'Optional heading', body: 'Prose. Can include basic HTML.' }
     ]
   }
*/
window.TRAVEL = {

  'czech-republic': {
    name: 'Czech Republic',
    flag: '🇨🇿',
    meta: 'Home base · Prague · lived here since birth',
    sections: [
      {
        heading: '',
        body: 'This is a test entry. Replace this with real prose when ready.'
      }
    ]
  },

};
