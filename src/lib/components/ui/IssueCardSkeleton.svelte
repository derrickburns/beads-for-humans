<script lang="ts">
	import Skeleton from './Skeleton.svelte';
</script>

<div class="p-4 border border-gray-200 rounded-xl bg-white animate-pulse">
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 space-y-3">
			<!-- Title skeleton -->
			<Skeleton width="75%" height="1.25rem" rounded="md" animate={false} />
			<!-- Description skeleton -->
			<Skeleton width="100%" height="0.75rem" rounded="sm" animate={false} />
			<Skeleton width="60%" height="0.75rem" rounded="sm" animate={false} />
			<!-- Tags -->
			<div class="flex gap-2 pt-2">
				<Skeleton width="4rem" height="1.5rem" rounded="full" animate={false} />
				<Skeleton width="5rem" height="1.5rem" rounded="full" animate={false} />
			</div>
		</div>
		<!-- Status indicator -->
		<Skeleton width="1.5rem" height="1.5rem" rounded="full" animate={false} />
	</div>
</div>
