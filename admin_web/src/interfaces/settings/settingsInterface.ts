
export interface ModulesInterface {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
    permissions: Array<PermissionsInterface>
}

export interface PaginatedModulesInterface {
    current_page: number,
    data: [ModulesInterface]
    first_page_url: string | null,
    from: number,
    last_page: number,
    last_page_url: string | null,
    links: any,
    next_page_url: string | null,
    path: string | null,
    per_page: number,
    prev_page_url: null | string,
    to: number,
    total: number
}

export interface PermissionsInterface {
    id: number;
    system_module_id: number;
    name: string;
    created_at: string;
    update_at: string
}