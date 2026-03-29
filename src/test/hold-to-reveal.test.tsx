import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HoldToRevealButton } from '../components/HoldToRevealButton'

describe('HoldToRevealButton', () => {
  it('toggles private role data visibility', () => {
    render(
      <HoldToRevealButton
        roleKey="merlin"
        roleLabel="Merlin"
        alignmentLabel="GOOD"
        power={{
          short: 'Sees evil except Mordred and Oberon',
          detail: 'Keep hidden from the assassin',
        }}
        visiblePlayers={['Player 2', 'Player 5']}
      />,
    )

    const button = screen.getByRole('button', { name: 'Reveal Role & Powers' })
    expect(screen.queryByText('Merlin')).not.toBeInTheDocument()

    fireEvent.click(button)
    expect(screen.getByText('Merlin')).toBeInTheDocument()
    expect(screen.getByText(/Known players:/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hide Role Details' }))
    expect(screen.queryByText('Merlin')).not.toBeInTheDocument()
  })
})
