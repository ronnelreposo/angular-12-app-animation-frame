import { expand, NEVER, of } from "rxjs";
import { Completion, Progressable, Series, Timeline } from "./app.component";


const series: Series = {
  id: 'season 1',
  episodes: [
    { id: 'e1', duration: 2_000 },
    { id: 'e2', duration: 2_000 },
    { id: 'e3', duration: 2_000 },
  ],
};


const initialSnapshot: Timeline & Progressable & Completion = {
  id: 'e1', // first episode.
  duration: 0,
  progress: 0,
  completionStatus: 'not-complete',
};

of(initialSnapshot)
  .pipe(
    expand(tpc => {

      return NEVER;
    })
  )

