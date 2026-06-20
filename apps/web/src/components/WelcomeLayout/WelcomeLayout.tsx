import { useRef, type ReactNode } from 'react'
import type { IconAnimationPhase, IconTransition } from '../../constants/transitions'
import { FLOAT_ITEM_COUNT } from '../../constants/transitions'
import { useContentEnterAnimation } from './useContentEnterAnimation'
import { useSceneIconsAnimation } from './useSceneIconsAnimation'
import './WelcomeLayout.css'

const ILLUSTRATIONS = {
  female: '/loginAndRegister/female-sitting-with-laptop.png',
  vase: '/loginAndRegister/vase-tulips-glasses-pencil.png',
  stopwatch: '/loginAndRegister/blue-stopwatch-pink-arrow.png',
  notifications: '/loginAndRegister/multicolored-smartphone-notifications.png',
  pieChart: '/loginAndRegister/pie-chart.png',
  coffee: '/loginAndRegister/pink-coffee-cup-close-up.png',
  calendar: '/loginAndRegister/blue-desk-calendar.png',
} as const

export type { IconTransition }

type SceneItemConfig = {
  index: number
  className: string
  content: ReactNode
}

const SCENE_ITEMS: SceneItemConfig[] = [
  {
    index: 0,
    className: 'welcome__scene-item--stopwatch',
    content: (
      <img
        className="welcome__illustration welcome__illustration--stopwatch"
        src={ILLUSTRATIONS.stopwatch}
        width={40}
        height={50}
        decoding="async"
        alt=""
      />
    ),
  },
  {
    index: 1,
    className: 'welcome__scene-item--dot-blue',
    content: <span className="welcome__dot welcome__dot--8 welcome__dot--blue" />,
  },
  {
    index: 2,
    className: 'welcome__scene-item--dot-purple',
    content: <span className="welcome__dot welcome__dot--4 welcome__dot--purple" />,
  },
  {
    index: 3,
    className: 'welcome__scene-item--calendar',
    content: (
      <img
        className="welcome__illustration welcome__illustration--calendar"
        src={ILLUSTRATIONS.calendar}
        width={31}
        height={28}
        decoding="async"
        alt=""
      />
    ),
  },
  {
    index: 4,
    className: 'welcome__scene-item--pie',
    content: (
      <img
        className="welcome__illustration welcome__illustration--pie"
        src={ILLUSTRATIONS.pieChart}
        width={26}
        height={26}
        decoding="async"
        alt=""
      />
    ),
  },
  {
    index: 5,
    className: 'welcome__scene-item--notifications',
    content: (
      <img
        className="welcome__illustration welcome__illustration--notifications"
        src={ILLUSTRATIONS.notifications}
        width={62}
        height={42}
        decoding="async"
        alt=""
      />
    ),
  },
  {
    index: 6,
    className: 'welcome__scene-item--vase',
    content: (
      <img
        className="welcome__illustration welcome__illustration--vase"
        src={ILLUSTRATIONS.vase}
        width={36}
        height={52}
        decoding="async"
        alt=""
      />
    ),
  },
  {
    index: 7,
    className: 'welcome__scene-item--coffee',
    content: (
      <img
        className="welcome__illustration welcome__illustration--coffee"
        src={ILLUSTRATIONS.coffee}
        width={18}
        height={22}
        decoding="async"
        alt=""
      />
    ),
  },
  {
    index: 8,
    className: 'welcome__scene-item--dot-green',
    content: <span className="welcome__dot welcome__dot--4 welcome__dot--green" />,
  },
  {
    index: 9,
    className: 'welcome__scene-item--dot-yellow',
    content: <span className="welcome__dot welcome__dot--8 welcome__dot--yellow" />,
  },
  {
    index: 10,
    className: 'welcome__scene-item--dot-pink',
    content: <span className="welcome__dot welcome__dot--8 welcome__dot--pink" />,
  },
  {
    index: 11,
    className: 'welcome__scene-item--dot-sky',
    content: <span className="welcome__dot welcome__dot--4 welcome__dot--sky" />,
  },
]

type WelcomeLayoutProps = {
  children: ReactNode
  variant?: 'default' | 'login'
  iconTransition?: IconTransition
  contentHidden?: boolean
  contentEntering?: boolean
  onIconsAnimationComplete?: (phase: IconAnimationPhase) => void
}

export function WelcomeLayout({
  children,
  variant = 'default',
  iconTransition = 'idle',
  contentHidden = false,
  contentEntering = false,
  onIconsAnimationComplete,
}: WelcomeLayoutProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const sceneItemsRef = useRef<(HTMLDivElement | null)[]>(
    Array.from({ length: FLOAT_ITEM_COUNT }, () => null),
  )

  const contentEnterPending = useContentEnterAnimation(contentRef, contentEntering)

  useSceneIconsAnimation({
    iconTransition,
    sceneItemsRef,
    onAnimationComplete: onIconsAnimationComplete,
  })

  const contentClassName = [
    'welcome__content',
    contentHidden ? 'welcome__content--hidden' : '',
    contentEnterPending ? 'welcome__content--enter-pending' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={[
        'welcome',
        variant === 'login' ? 'welcome--login' : '',
        iconTransition !== 'idle' ? 'welcome--animating-icons' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg className="welcome__svg-defs" aria-hidden="true" width="0" height="0">
        <defs>
          <clipPath id="welcome-button-shape" clipPathUnits="objectBoundingBox">
            <path d="M 0 0.2692 A 0.0423 0.2692 0 0 1 0.0423 0.0769 Q 0.5 0 0.9577 0.0769 A 0.0423 0.2692 0 0 1 1 0.2692 L 1 0.7308 A 0.0423 0.2692 0 0 1 0.9577 0.9231 Q 0.5 1 0.0423 0.9231 A 0.0423 0.2692 0 0 1 0 0.7308 Z" />
          </clipPath>
        </defs>
      </svg>
      <div className="welcome__blobs" aria-hidden="true">
        <span className="welcome__blob welcome__blob--green" />
        <span className="welcome__blob welcome__blob--yellow-top" />
        <span className="welcome__blob welcome__blob--blue-right" />
        <span className="welcome__blob welcome__blob--cyan" />
        <span className="welcome__blob welcome__blob--yellow-bottom" />
      </div>

      <div className="welcome__hero">
        <div className="welcome__scene" aria-hidden="true">
          {SCENE_ITEMS.map(({ index, className, content }) => (
            <div
              key={index}
              ref={(node) => {
                sceneItemsRef.current[index] = node
              }}
              className={`welcome__scene-item ${className}`}
              data-item-index={index}
            >
              {content}
            </div>
          ))}
          <img
            className="welcome__illustration welcome__illustration--female"
            src={ILLUSTRATIONS.female}
            width={159}
            height={184}
            decoding="async"
            fetchPriority="high"
            alt=""
          />
        </div>
      </div>

      <div ref={contentRef} className={contentClassName}>
        {children}
      </div>
    </div>
  )
}
