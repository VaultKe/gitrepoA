<template>
    <div>
        <div v-if="!aps.length">
            <div class="alert alert-info">
                <p class="my-0">Pending Approvals</p>
            </div>
        </div>
        <UIComponentCard title="" v-else>
            <b-accordion>
                <b-accordion-item title="First Approval History" header-class="m-0" button-class="fw-semibold" visible>
                    <div class="card">
                        <div class="card-body">
                            <div v-if="first_approver_data.length">
                                <div class="border rounded-2 py-1 px-1 mb-1" v-for="(a, i) in first_approver_data"
                                    :key="i">
                                    <h5 class="card-title text-center">Round {{ i + 1 }}</h5>
                                    <div class="table-responsive">
                                        <table class="table table-sm table-striped table-bordered">
                                            <tbody>
                                                <tr>
                                                    <th>Approver</th>
                                                    <td>{{ a.approver?.name }} ~ {{ a.approver?.phone_number }}</td>

                                                </tr>
                                                <tr>
                                                    <th>Decision</th>
                                                    <td>{{ a.decision }}</td>

                                                </tr>
                                                <tr>
                                                    <th>Remarks</th>
                                                    <td>{{ a.comments }}</td>

                                                </tr>
                                                <tr>
                                                    <th>Date</th>
                                                    <td>{{ formatDate(a.created_at, true) }}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div class="border rounded-2 py-1 px-1 bg-light" v-if="a.responses?.length">
                                        <h5>Questionnaire Responses</h5>
                                        <div v-for="(k, i) in a.responses" :key="i">
                                            <p class="my-1">{{ k.question }}</p>
                                            <p class="bg-white py-1 px-1 my-0">{{ k.answer }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="alert alert-info py-1">
                                <p class="my-1">No record</p>
                            </div>
                        </div>
                    </div>
                </b-accordion-item>
                <b-accordion-item title="Second Approval History" header-class="m-0" button-class="fw-semibold">
                    <div class="card">
                        <div class="card-body">
                            <div v-if="second_approver_data.length">
                                <div class="border rounded-2 py-1 px-1 mb-1" v-for="(a, i) in second_approver_data"
                                    :key="i">
                                    <h5 class="card-title text-center">Round {{ i + 1 }}</h5>
                                    <div class="table-responsive">
                                        <table class="table table-sm table-striped table-bordered">
                                            <tbody>
                                                <tr>
                                                    <th>Approver</th>
                                                    <td>{{ a.approver?.name }} ~ {{ a.approver?.phone_number }}</td>

                                                </tr>
                                                <tr>
                                                    <th>Decision</th>
                                                    <td>{{ a.decision }}</td>

                                                </tr>
                                                <tr>
                                                    <th>Remarks</th>
                                                    <td>{{ a.comments }}</td>

                                                </tr>
                                                <tr v-if="a.upload">
                                                    <th>Attachment</th>
                                                    <td><a :href="a.upload" target="_blank"
                                                            class="text-primary">View</a></td>

                                                </tr>
                                                <tr>
                                                    <th>Date</th>
                                                    <td>{{ formatDate(a.created_at, true) }}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div class="border rounded-2 py-1 px-1 bg-light" v-if="a.responses?.length">
                                        <h5>Questionnaire Responses</h5>
                                        <div v-for="(k, i) in a.responses" :key="i">
                                            <p class="my-1">{{ k.question }}</p>
                                            <p class="bg-white py-1 px-1 my-0">{{ k.answer }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="alert alert-info py-1">
                                <p class="my-1">No record</p>
                            </div>
                        </div>
                    </div>
                </b-accordion-item>
                <b-accordion-item title="Final Approval History" header-class="m-0" button-class="fw-semibold">
                    <div class="card">
                        <div class="card-body">
                            <div v-if="final_approver_data.length">
                                <div class="border rounded-2 py-1 px-1 mb-1" v-for="(a, i) in final_approver_data"
                                    :key="i">
                                    <h5 class="card-title text-center">Round {{ i + 1 }}</h5>
                                    <div class="table-responsive">
                                        <table class="table table-sm table-striped table-bordered">
                                            <tbody>
                                                <tr>
                                                    <th>Approver</th>
                                                    <td>{{ a.approver?.name }} ~ {{ a.approver?.phone_number }}</td>

                                                </tr>
                                                <tr>
                                                    <th>Decision</th>
                                                    <td>{{ a.decision }}</td>

                                                </tr>
                                                <tr>
                                                    <th>Remarks</th>
                                                    <td>{{ a.comments }}</td>

                                                </tr>
                                                <tr v-if="a.upload">
                                                    <th>Attachment</th>
                                                    <td><a :href="a.upload" target="_blank"
                                                            class="text-primary">View</a></td>

                                                </tr>
                                                <tr>
                                                    <th>Date</th>
                                                    <td>{{ formatDate(a.created_at, true) }}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div class="border rounded-2 py-1 px-1 bg-light" v-if="a.responses?.length">
                                        <h5>Questionnaire Responses</h5>
                                        <div v-for="(k, i) in a.responses" :key="i">
                                            <p class="my-1">{{ k.question }}</p>
                                            <p class="bg-white py-1 px-1 my-0">{{ k.answer }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="alert alert-info py-1">
                                <p class="my-1">No record</p>
                            </div>
                        </div>
                    </div>
                </b-accordion-item>
            </b-accordion>
        </UIComponentCard>
    </div>
</template>
<script setup>
import { computed } from 'vue';
import { formatDate } from '@/helpers/helper'
import UIComponentCard from "@/components/UIComponentCard.vue";
const props = defineProps({
    aps: {
        type: Array,
        required: true
    }
});

const first_approver_data = computed(() => props.aps.filter((item) => item.level == 'first'));
const second_approver_data = computed(() => props.aps.filter((item) => item.level == 'second'));
const final_approver_data = computed(() => props.aps.filter((item) => item.level == 'final'));

</script>