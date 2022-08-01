import { Component, OnInit } from '@angular/core';
import {
  animationFrames,
  BehaviorSubject,
  concat,
  EMPTY,
  fromEvent,
  identity,
  interval,
  merge,
  Observable,
  of,
  repeat,
  startWith,
  Subject,
  take,
} from 'rxjs';
import {
  endWith,
  expand,
  last,
  map,
  scan,
  switchMap,
  switchScan,
  takeWhile,
  withLatestFrom,
} from 'rxjs/operators';

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
function easeOutElastic(x: number): number {
  const c4 = (2 * Math.PI) / 3;

  return x === 0
    ? 0
    : x === 1
    ? 1
    : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}

const duration$ = (durationMs: number) => {
  return animationFrames().pipe(
    map(({ elapsed }) => elapsed / durationMs),
    takeWhile((percentage) => percentage < 1),
    endWith(1)
  );
};
function tween(
  start: number,
  end: number,
  duration: number,
  easingFunction: (x: number) => number = identity
) {
  const delta = end - start;

  return duration$(duration).pipe(
    map(easingFunction),
    map((percentage) => percentage * delta + start)
  );
}

export type Timeline = {
  id: string;
  duration: number;
};

// type Movie = Timeline
export type Series = {
  id: string;
  episodes: Timeline[];
};

export type Progressable = { progress: number };
export type Completion = { completionStatus: 'complete' | 'not-complete' };
// type EpochCompletion = { epochompletionStatus: 'complete' | 'not-complete' };

const toProgress = <T>(x: T, progress: number): T & Progressable => ({
  ...x,
  progress,
});

// Helpers ==========================================

const getRestArrayOnFirstMatch = <T>(allEpisodes: T[], matchEpisode: (timeline: T) => boolean): T[] => {
  const firstMatchIndex = allEpisodes.findIndex(x => matchEpisode(x));
  return firstMatchIndex === -1 ? [] : allEpisodes.slice(firstMatchIndex + 1);
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'component-overview';

  constructor() {}

  ngOnInit(): void {
    animationFrames().pipe(take(100));

    // const ball = document.getElementById('ball');
    // tween(0, 300, 2000, easeOutElastic).subscribe((x) => {
    //   ball.style.left = `${x}px`;
    //   console.log(x);
    // });

    this.domain();
  }

  domain() {
    const movie: Timeline = {
      id: 'movie 1',
      duration: 2_000,
    };

    const movie2: Timeline = {
      id: 'movie 2',
      duration: 3_000,
    };

    const series: Series = {
      id: 'season 1',
      episodes: [
        { id: 'e1', duration: 2_000 },
        { id: 'e2', duration: 2_000 },
        { id: 'e3', duration: 2_000 },
      ],
    };

    // create a resumable series.

    const pauseOrResumeOnClick$: Observable<'paused' | 'running'> = fromEvent(
      document,
      'click'
    ).pipe(
      scan((a, _) => (a === 'paused' ? 'running' : 'paused'), 'paused'),
      startWith<'paused'>('paused')
    );

    // // test pause resume.
    // interval(1_000)
    //   .pipe(withLatestFrom(pauseOrResumeOnClick$))
    //   .subscribe((x) => {
    //     console.log('pause or resume: ', x);
    //   });

    const playSeriesEpisodes$ = (episodes: Series['episodes']) => {
      return episodes.reduce((s$, episode) => {
        const runningEpisode$: Observable<Timeline & Progressable> = duration$(
          episode.duration
        )
          // TODO. abstract mapping.
          .pipe(map((progress) => ({ ...episode, progress })));
        return concat(s$, runningEpisode$);
      }, EMPTY);
    };

    // // Typical restart of series on resume.
    // pauseOrResumeOnClick$.pipe(
    //   switchMap((pauseOrResume) =>
    //     pauseOrResume === 'paused'
    //       ? EMPTY
    //       : playSeriesEpisodes$(series.episodes)
    //   )
    // );


    const getRestEpisodes = (lastSnapshot: Timeline & Progressable, allEpisodes: Timeline[]) => {
      return getRestArrayOnFirstMatch(allEpisodes, timeline => timeline.id === lastSnapshot.id)
      .map((x) => ({ ...x, progress: 0 }));
    };

    const resumePlaySeries$ = (lastSnapshot: Timeline & Progressable & Completion, series: Series) => {
      // Remaining time of last snapshot.
      const remainingTime = lastSnapshot.duration * (1 - lastSnapshot.progress);
      const continueLastTimeline$ = tween(lastSnapshot.progress, 1, remainingTime)
        .pipe(map((progress) => toProgress(lastSnapshot, progress)));
      const playingRestEpisodes$ = playSeriesEpisodes$(getRestEpisodes(lastSnapshot, series.episodes));
      return concat(continueLastTimeline$, playingRestEpisodes$);
    };

    /**
     * // track if the season is finished. TODO. make it visible in season data structure.
     */
    const toCompletion = (lastSnapshot: Timeline & Progressable): Timeline & Progressable & Completion => {
      if (lastSnapshot.id === 'e3' && lastSnapshot.progress === 1) {
        return { ...lastSnapshot, completionStatus: 'complete' };
      } else {
        return { ...lastSnapshot, completionStatus: 'not-complete' };
      }
    };

    const initialSnapshot: Timeline & Progressable & Completion = {
      id: 'e1', // first episode.
      duration: 0,
      progress: 0,
      completionStatus: 'not-complete',
    };
    const ball1 = document.getElementById('ball1');
    const ball2 = document.getElementById('ball2');
    const ball3 = document.getElementById('ball3');

    
    /* Pause or resume on click can be switch scanned by the main timeline,
    / when the second timeline comes in, it will trigger run, when the third
    / timeline signals, we can pause it, thereby saving the last snapshot of the series.
    / merge(timeline1, timeline2, timeline3).pipe(switchScan(...))
    */
    pauseOrResumeOnClick$
      .pipe(
        switchScan((lastSnapshot, pauseOrResume) => {
          if (pauseOrResume === 'paused') {
            return of(toCompletion(lastSnapshot));
          } else {

            // Begin.
            if (lastSnapshot.id === "e1" && lastSnapshot.progress === 0) {
              return playSeriesEpisodes$(series.episodes);
            }
            else { // Resume.
              return resumePlaySeries$(lastSnapshot, series).pipe(map(toCompletion));
            }
          }
        }, initialSnapshot)
      ).subscribe((x) => {

        // console.log("[debug] progress: ", x);

        if (x.id === 'e1') {
          ball1.style.left = `${x.progress * 100}px`;
        }
        if (x.id === 'e2') {
          ball2.style.left = `${x.progress * 100}px`;
        }
        if (x.id === 'e3') {
          ball3.style.left = `${x.progress * 100}px`;
        }

        // upon complete. re-trigger using subject. cheap and easy.
      });
  }
}
