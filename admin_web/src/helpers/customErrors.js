export class CustomAxiosError extends Error {
    constructor(response) {
        // Ensure to call the parent Error constructor
        super(response.message || 'An error occurred');  // Default message if none is provided

        // Set the name of the error to the class name
        this.name = this.constructor.name;

        // Capture additional error properties
        this.status = response.status || null;  // Status message (e.g., "Unprocessable Content")
        this.code = response.code || null;  // Numeric error code (e.g., 422)
        this.message = response.message || '';  // Error message
        this.data = response.data || null;  // Additional data or null
        this.errors = response.errors || {};  // Validation errors, if any

        // Optional: Capture the stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    // Helper method to extract specific error messages from the validation errors
    getValidationErrors() {
        const validationErrors = [];
        for (const [field, messages] of Object.entries(this.errors)) {
            validationErrors.push(`${field}: ${messages.join(', ')}`);
        }
        return validationErrors;
    }
}

export const getValidationErrors = (errors) => {
    let validationErrors = [];
    for (const [field, messages] of Object.entries(errors)) {
        validationErrors.push(`${messages.join(', ')}`);
    }
    return validationErrors;
}
