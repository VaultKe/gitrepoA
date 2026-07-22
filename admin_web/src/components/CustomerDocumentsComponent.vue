<template>
    <div class="mb-2">
        <UIComponentCard>
            <b-tabs>
                <!-- Documents Tab -->
                <b-tab :title="`Documents (${documents.length})`" active>
                    <div class="card card-body py-2 px-0">
                        <div class="table-responsive">
                            <b-table-simple responsive class="mb-0 browser_users">
                                <b-thead class="table-light">
                                    <b-tr>
                                        <b-th class="border-top-0">Name</b-th>
                                        <b-th class="border-top-0 text-end">Last Modified</b-th>
                                        <b-th class="border-top-0 text-end">Size</b-th>
                                        <b-th class="border-top-0 text-end">Action</b-th>
                                    </b-tr>
                                </b-thead>
                                <b-tbody>
                                    <b-tr v-for="(d, i) in documents" :key="i">
                                        <b-td>
                                            <div
                                                class="d-inline-flex justify-content-center align-items-center thumb-md bg-blue-subtle rounded mx-auto me-1">
                                                <i
                                                    class="fa-solid fa-file-pdf fs-18 align-self-center mb-0 text-blue"></i>
                                            </div>
                                            <a :href="d.url" class="text-body" download>
                                                {{ d.file_type?.name ?? d.custom_name ?? 'Untitled' }}.pdf
                                            </a>
                                        </b-td>
                                        <b-td class="text-end">{{ formatDate(d.created_at) }}</b-td>
                                        <b-td class="text-end">{{ d.file_size_mb }}MB</b-td>
                                        <b-td class="text-end">
                                            <div class="btn-group">
                                                <a :href="d.url" class="btn btn-sm btn-primary" target="_blank">
                                                    <i class="las la-download fs-18"></i>
                                                </a>
                                                <!--<a href="#" class="btn btn-sm btn-danger">
                                                    <i class="las la-trash-alt fs-18"></i>
                                                </a>-->
                                            </div>
                                        </b-td>
                                    </b-tr>
                                </b-tbody>
                            </b-table-simple>
                        </div>
                    </div>
                </b-tab>

                <!-- Images Tab -->
                <b-tab :title="`Images (${structured_images.length})`">
                    <div v-if="structured_images.length">
                        <Gallery :images="structured_images" />
                    </div>
                    <div v-else class="text-muted text-center py-3">No images available</div>
                </b-tab>
            </b-tabs>
        </UIComponentCard>
    </div>
</template>

<script setup>
import { defineProps } from "vue";
import Gallery from "@/components/Gallery.vue";
import {
    formatDate,

} from "@/helpers/helper";
import UIComponentCard from "@/components/UIComponentCard.vue";



const props = defineProps({
    documents: {
        type: Array,
        default: () => []
    },
    structured_images: {
        type: Array,
        default: () => []
    }
});


</script>
