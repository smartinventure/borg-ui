import { useEffect, useRef, useState, useCallback } from 'react';
import { eventsAPI } from '../services/api';

interface SSEEvent {
  type: string;
  data: any;
  timestamp: string;
}

interface UseSSEReturn {
  isConnected: boolean;
  lastEvent: SSEEvent | null;
  events: SSEEvent[];
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
}

export const useSSE = (): UseSSEReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = eventsAPI.streamEvents();
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log('SSE connection established');
      };

      eventSource.onmessage = (event) => {
        try {
          const sseEvent: SSEEvent = JSON.parse(event.data);
          setLastEvent(sseEvent);
          setEvents(prev => [...prev, sseEvent]);
          
          // Keep only last 100 events to prevent memory issues
          if (events.length > 100) {
            setEvents(prev => prev.slice(-100));
          }
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsConnected(false);
        
        // Reconnect after 5 seconds to prevent rapid reconnections
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect SSE...');
          connect();
        }, 5000);
      };

      eventSource.addEventListener('error', (event) => {
        console.error('SSE error event:', event);
        setIsConnected(false);
      });

    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  useEffect(() => {
    // Auto-connect on mount
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    events,
    connect,
    disconnect,
    clearEvents,
  };
};

// Hook for specific event types
export const useSSEEvent = (eventType: string) => {
  const { events, isConnected } = useSSE();
  
  const filteredEvents = events.filter(event => event.type === eventType);
  const lastEvent = filteredEvents[filteredEvents.length - 1] || null;
  
  return {
    events: filteredEvents,
    lastEvent,
    isConnected,
  };
};

// Hook for backup progress
export const useBackupProgress = (jobId?: string) => {
  const { events, isConnected } = useSSE();
  
  const backupEvents = events.filter(event => 
    event.type === 'backup_progress' && 
    (!jobId || event.data.job_id === jobId)
  );
  
  const lastProgress = backupEvents[backupEvents.length - 1] || null;
  
  return {
    progress: lastProgress?.data || null,
    isConnected,
    allProgress: backupEvents,
  };
};

// Hook for system status
export const useSystemStatus = () => {
  const { lastEvent, isConnected } = useSSE();
  
  const systemStatus = lastEvent?.type === 'system_status' ? lastEvent.data : null;
  
  return {
    systemStatus,
    isConnected,
  };
};
