import { useCallback, useState } from 'react';
import { INITIAL_ACTIVITIES } from '@/data/seedData';

export function useActivities() {
  const [activities, setActivities] = useState(INITIAL_ACTIVITIES);

  const addActivity = useCallback((activity) => {
    setActivities(prev => [activity, ...prev]);
  }, []);

  return { activities, addActivity };
}