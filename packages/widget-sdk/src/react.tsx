import type { CSSProperties, ForwardedRef } from 'react'
import type { MountNeutralTradeWidgetOptions, NeutralTradeWidgetController } from './mount'
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { mountNeutralTradeWidget } from './mount'

export interface NeutralTradeWidgetProps
  extends Omit<MountNeutralTradeWidgetOptions, 'element' | 'onEvent'> {
  className?: string
  onEvent?: MountNeutralTradeWidgetOptions['onEvent']
  style?: CSSProperties
}

function setForwardedRef(
  forwardedRef: ForwardedRef<NeutralTradeWidgetController>,
  value: NeutralTradeWidgetController | null,
): void {
  if (typeof forwardedRef === 'function')
    forwardedRef(value)
  else if (forwardedRef)
    forwardedRef.current = value
}

export const NeutralTradeWidget = forwardRef<
  NeutralTradeWidgetController,
  NeutralTradeWidgetProps
>((
  {
    builderCode,
    className,
    cluster,
    height,
    launcherLabel,
    mode,
    onEvent,
    rpcUrl,
    signer,
    style,
    transport,
    vaults,
    verifierLimits,
  },
  forwardedRef,
) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const onEventRef = useRef(onEvent)
  const [controller, setController] = useState<NeutralTradeWidgetController | null>(null)
  const vaultsFingerprint = JSON.stringify([...new Set(vaults)])
  const vaultsSnapshot = useMemo(
    () => JSON.parse(vaultsFingerprint) as Array<string>,
    [vaultsFingerprint],
  )
  const maxComputeUnitLimit = verifierLimits?.maxComputeUnitLimit
  const maxComputeUnitPriceMicroLamports
    = verifierLimits?.maxComputeUnitPriceMicroLamports
  const verifierLimitsSnapshot = useMemo<MountNeutralTradeWidgetOptions['verifierLimits']>(
    () => maxComputeUnitLimit === undefined
      && maxComputeUnitPriceMicroLamports === undefined
      ? undefined
      : {
          maxComputeUnitLimit,
          maxComputeUnitPriceMicroLamports,
        },
    [maxComputeUnitLimit, maxComputeUnitPriceMicroLamports],
  )
  onEventRef.current = onEvent

  useEffect(() => {
    const container = containerRef.current
    if (!container)
      return
    const mountedController = mountNeutralTradeWidget({
      builderCode,
      cluster,
      element: container,
      height,
      launcherLabel,
      mode,
      onEvent: event => onEventRef.current?.(event),
      rpcUrl,
      signer,
      transport,
      vaults: vaultsSnapshot,
      verifierLimits: verifierLimitsSnapshot,
    })
    setController(mountedController)
    return () => {
      mountedController.destroy()
    }
  }, [
    builderCode,
    cluster,
    height,
    launcherLabel,
    mode,
    rpcUrl,
    signer,
    transport,
    vaultsSnapshot,
    verifierLimitsSnapshot,
  ])

  useEffect(() => {
    if (!controller)
      return
    setForwardedRef(forwardedRef, controller)
    return () => setForwardedRef(forwardedRef, null)
  }, [controller, forwardedRef])

  return <div className={className} ref={containerRef} style={style} />
})
