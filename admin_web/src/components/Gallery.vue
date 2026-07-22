<template>
    <b-row class="justify-content-center">
        <b-col cols="12">
            <UIComponentCard title="">
                <b-row id="grid" class="g-0">
                    <b-col md="4" lg="3" class="picture-item" v-for="(img, idx) in localImages" :key="idx">
                        <figure>
                            <a :href="img.src" class="lightbox">
                                <img :src="img.src" alt="" class="img-fluid" />
                            </a>
                            <figcaption>{{ img.caption }} <span
                                    v-if="img.id && hasPermission('Can delete customer document')"
                                    @click="showDeleteAlert(img.id)" class="btn btn-danger btn-sm py-0 px-1"><i
                                        class="fas fa-trash-alt"></i></span>
                            </figcaption>
                        </figure>
                    </b-col>
                </b-row>
            </UIComponentCard>
        </b-col>
    </b-row>

</template>

<script setup lang="ts">
import { onMounted, nextTick, ref, watch } from "vue";
import Swal from "sweetalert2/dist/sweetalert2.js";
import "sweetalert2/src/sweetalert2.scss";
import customerService from "@/api/customer-managament/customerManagementApi.js";
import UIComponentCard from "@/components/UIComponentCard.vue";
import { useApiState } from "@/stores/apiState";
import { hasPermission } from "@/helpers/permissions";
const apiState = useApiState();
import Tobii from "tobii";


const props = defineProps<{
    images: { src: string; caption: string, id?: number }[];
}>();

// Local reactive copy of images
const localImages = ref([...props.images]);

// Sync if parent images change
watch(() => props.images, (newVal) => {
    localImages.value = [...newVal];
});

onMounted(() => {
    nextTick(() => {
        new Tobii({
            selector: '.lightbox',
        });
    });
});

const delete_document = async (id: number) => {
    try {
        apiState.setSaving(true);
        const response = await customerService.deleteCustomerDocument(id);
        apiState.setSaving(false);
        apiState.setSuccess(true)
        apiState.setMessage(response.message)
        // Remove the image from localImages
        localImages.value = localImages.value.filter((img) => img.id !== id);
    } catch (error: any) {
        apiState.setSaving(false);
        apiState.setError(true);
        apiState.setMessage(error.message);
    }
}


const showDeleteAlert = async (id: any) => {
    // Use sweetalert2
    Swal.fire({
        // title: "Warning",
        text: `Are you sure you want to delete this document?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d63054",
        cancelButtonText: "Cancel",
        confirmButtonText: "Delete",
    }).then(async (result: any) => {
        if (result.isConfirmed) {
            await delete_document(id);
        }
    });
};


</script>