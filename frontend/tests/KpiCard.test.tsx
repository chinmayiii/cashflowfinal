import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KpiCard } from '../src/components/ui/KpiCard';
import { IndianRupee } from 'lucide-react';

describe('KpiCard Component', () => {
  it('renders title, formatted value, and positive change badge', () => {
    render(
      <KpiCard
        title="Current Balance"
        value="₹1,45,800"
        change={4.2}
        icon={IndianRupee}
        badgeText="Healthy"
        badgeType="success"
      />
    );

    expect(screen.getByText('Current Balance')).toBeInTheDocument();
    expect(screen.getByText('₹1,45,800')).toBeInTheDocument();
    expect(screen.getByText('+4.2%')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });
});
