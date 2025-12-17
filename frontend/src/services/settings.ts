const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface ScoreRange {
  min: number;
  max: number;
  score: number;
}

export interface MultiplierConfig {
  multiplier: number; // e.g., 1.5, 2, 3
  name?: string; // Optional name for analytics table
  ranges: ScoreRange[];
}

export interface TimeBucketRange {
  min: number; // seconds
  max: number; // seconds
  score: number;
}

export interface ScoringSettings {
  trackingTimeSeconds: number; // min 15, max 120
  rugThresholdMcap: number; // X SOL amount in market cap (default 6000)
  includeTimeBucketRugRate: boolean; // Whether to include time bucket rug rate in total score (default false)
  winRate: {
    name?: string; // Optional name for analytics table
    ranges: ScoreRange[];
  };
  avgAthMcap: {
    name?: string; // Optional name for analytics table
    ranges: ScoreRange[];
  };
  medianAthMcap: {
    name?: string; // Optional name for analytics table
    ranges: ScoreRange[];
  };
  multiplierConfigs: MultiplierConfig[]; // % of tokens that at least "a"x from starting MCAP
  avgRugRate: {
    name?: string; // Optional name for analytics table
    ranges: ScoreRange[];
  };
  avgRugRateByTimeBucket: {
    name?: string; // Optional name for analytics table
    ranges: TimeBucketRange[]; // Time buckets are extracted from these ranges (min/max values in seconds)
  };
}

export interface ScoringPreset {
  id: number;
  name: string;
  settings: ScoringSettings;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PresetsResponse {
  presets: ScoringPreset[];
}

export async function getScoringPresets(): Promise<ScoringPreset[]> {
  const response = await fetch(`${API_BASE_URL}/settings`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch scoring presets');
  }

  const data: PresetsResponse = await response.json();
  return data.presets || [];
}

export async function getScoringPreset(id: number): Promise<ScoringPreset> {
  const response = await fetch(`${API_BASE_URL}/settings/${id}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 404) {
      throw new Error('Preset not found');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch scoring preset');
  }

  return await response.json();
}

export async function getDefaultScoringPreset(): Promise<ScoringPreset> {
  const response = await fetch(`${API_BASE_URL}/settings/default/get`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 404) {
      throw new Error('No default preset found');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch default scoring preset');
  }

  return await response.json();
}

export async function createScoringPreset(
  name: string,
  settings: ScoringSettings,
  isDefault: boolean = false
): Promise<ScoringPreset> {
  const response = await fetch(`${API_BASE_URL}/settings`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, settings, isDefault }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 409) {
      throw new Error('A preset with this name already exists');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to create scoring preset');
  }

  return await response.json();
}

export async function updateScoringPreset(
  id: number,
  updates: {
    name?: string;
    settings?: ScoringSettings;
    isDefault?: boolean;
  }
): Promise<ScoringPreset> {
  const response = await fetch(`${API_BASE_URL}/settings/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 404) {
      throw new Error('Preset not found');
    }
    if (response.status === 409) {
      throw new Error('A preset with this name already exists');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to update scoring preset');
  }

  return await response.json();
}

export async function deleteScoringPreset(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/settings/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 404) {
      throw new Error('Preset not found');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete scoring preset');
  }
}

export async function setDefaultPreset(id: number): Promise<ScoringPreset> {
  const response = await fetch(`${API_BASE_URL}/settings/${id}/set-default`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 404) {
      throw new Error('Preset not found');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to set default preset');
  }

  return await response.json();
}

export interface AppliedSettings {
  presetId: number | null;
  settings: ScoringSettings;
  appliedAt: string | null;
  updatedAt: string | null;
}

export async function getAppliedSettings(): Promise<AppliedSettings> {
  const response = await fetch(`${API_BASE_URL}/settings/applied/get`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch applied settings');
  }

  return await response.json();
}

export async function applySettings(settings: ScoringSettings, presetId?: number): Promise<AppliedSettings> {
  const response = await fetch(`${API_BASE_URL}/settings/applied/apply`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ settings, presetId }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 400) {
      const error = await response.json();
      throw new Error(error.errors ? error.errors.join(', ') : error.error || 'Validation failed');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to apply settings');
  }

  return await response.json();
}

