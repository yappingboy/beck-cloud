import { useQuery } from '@tanstack/react-query';
import { Frown, HeartCrack } from 'lucide-react';

import { generatePreview } from '@/utils/meshUtils';
import { useMeshData } from '@/hooks/useMeshData';

/**
 * Pure visual: renders the mesh thumbnail (or an icon-only placeholder for
 * loading/missing/failure states). Status text and titles are owned by the
 * parent component (MeshToolBlock surfaces them in its header;
 * MeshContextChip surfaces filename + filetype next to the thumbnail).
 * Don't reintroduce a "3D Object" label here — it duplicated MeshToolBlock's
 * own title and rendered twice in the message bubble.
 */
export function MeshImagePreview({ meshId }: { meshId: string }) {
  const {
    data: { data: meshData, isLoading: isMeshDataLoading },
    blob: { data: meshBlob },
  } = useMeshData({
    id: meshId,
  });

  const { data: meshPreview } = useQuery({
    queryKey: ['meshPreview', meshId],
    enabled: !!meshBlob,
    queryFn: async () => {
      if (!meshBlob) {
        return null;
      }
      return generatePreview(meshBlob, meshData?.file_type || 'glb');
    },
    staleTime: Infinity,
  });

  if (!isMeshDataLoading && !meshData) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-adam-neutral-950">
        <Frown className="h-6 w-6 text-white" />
      </div>
    );
  }

  if (meshData?.status === 'failure') {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-adam-neutral-950">
        <HeartCrack className="h-6 w-6 text-white" />
      </div>
    );
  }

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-lg bg-adam-neutral-950 ${
        meshPreview ? '' : 'animate-pulse'
      }`}
    >
      {meshPreview ? (
        <img src={meshPreview} alt="" className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}
