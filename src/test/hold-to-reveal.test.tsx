import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HoldToRevealButton } from '../components/HoldToRevealButton'

describe('HoldToRevealButton', () => {
  it('reveals private role data only while held', () => {
    render(
      <HoldToRevealButton
        roleLabel="Merlin"
        alignmentLabel="GOOD"
        power={{
          short: 'Sees evil except Mordred and Oberon',
          detail: 'Keep hidden from the assassin',
        }}
      />,
    )

    const button = screen.getByRole('button', { name: 'Hold to Reveal' })
    expect(screen.queryByText('Merlin')).not.toBeInTheDocument()

    fireEvent.mouseDown(button)
    expect(screen.getByText('Merlin')).toBeInTheDocument()

    fireEvent.mouseUp(button)
    expect(screen.queryByText('Merlin')).not.toBeInTheDocument()
  })
})
