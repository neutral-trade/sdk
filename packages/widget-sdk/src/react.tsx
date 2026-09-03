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

function getThemeFingerprint(
  theme: MountNeutralTradeWidgetOptions['theme'],
): string | undefined {
  if (theme === undefined)
    return undefined
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(theme).sort(([firstKey], [secondKey]) => (
        firstKey.localeCompare(secondKey)
      )),
    ),
  )
}

export const NeutralTradeWidget = forwardRef<
  NeutralTradeWidgetController,
  NeutralTradeWidgetProps
>((
  {
    builderAddress,
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
    theme,
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
  const themeFingerprint = getThemeFingerprint(theme)
  const themeSnapshot = useMemo<MountNeutralTradeWidgetOptions['theme']>(
    () => themeFingerprint === undefined
      ? undefined
      : JSON.parse(themeFingerprint) as MountNeutralTradeWidgetOptions['theme'],
    [themeFingerprint],
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
      builderAddress,
      builderCode,
      cluster,
      element: container,
      height,
      launcherLabel,
      mode,
      onEvent: event => onEventRef.current?.(event),
      rpcUrl,
      signer,
      theme: themeSnapshot,
      transport,
      vaults: vaultsSnapshot,
      verifierLimits: verifierLimitsSnapshot,
    })
    setController(mountedController)
    return () => {
      mountedController.destroy()
    }
  }, [
    builderAddress,
    builderCode,
    cluster,
    height,
    launcherLabel,
    mode,
    rpcUrl,
    signer,
    themeSnapshot,
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
