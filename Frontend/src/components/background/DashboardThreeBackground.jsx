import { useMemo } from 'react'
import dashboardModelImage from '../../../thumbnail.png'

const PRESET_CONFIG = {
  subtle: 'opacity-85 [mask-image:radial-gradient(circle_at_center,black_0%,black_50%,transparent_96%)]',
  medium: 'opacity-95 [mask-image:radial-gradient(circle_at_center,black_0%,black_56%,transparent_96%)]',
  bold: 'opacity-100 [mask-image:radial-gradient(circle_at_center,black_0%,black_62%,transparent_96%)]',
}

export function DashboardThreeBackground({ preset = 'medium' }) {
  const maskClass = useMemo(() => PRESET_CONFIG[preset] || PRESET_CONFIG.medium, [preset])

  return (
    <div className={`h-full w-full ${maskClass}`}>
      <img
        src={dashboardModelImage}
        alt="Dashboard 3D model"
        className="h-full w-full object-cover object-center"
        loading="eager"
      />
    </div>
  )
}

export default DashboardThreeBackground
