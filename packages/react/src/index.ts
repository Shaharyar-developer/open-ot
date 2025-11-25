import { useState, useEffect, useRef } from "react";
import { OTClient, OTClientOptions } from "@open-ot/client";

export function useOTClient<Snapshot, Op>(
  options: OTClientOptions<Snapshot, Op>
) {
  // Use a ref to store the client instance to ensure it's only created once
  // and persists across renders without re-initialization.
  const clientRef = useRef<OTClient<Snapshot, Op> | null>(null);

  // Initialize client lazily
  if (!clientRef.current) {
    clientRef.current = new OTClient(options);
  }

  const client = clientRef.current;
  const [snapshot, setSnapshot] = useState<Snapshot>(client.getSnapshot());

  useEffect(() => {
    // Subscribe to changes
    const unsubscribe = client.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    return () => {
      unsubscribe();
      // Ideally, we should also disconnect the transport here if the component unmounts
      // But OTClient doesn't expose a disconnect method directly on itself yet,
      // and we might want to keep the connection alive if the client is shared.
      // For this hook, we assume the client lifecycle is tied to the component.
      if (options.transport) {
        options.transport.disconnect();
      }
    };
  }, [client, options.transport]);

  return { client, snapshot };
}
