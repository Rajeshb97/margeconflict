
import { LightningElement, wire , track} from 'lwc';
import getCases from '@salesforce/apex/CopilotApexClass.getCases';
import updateCases from '@salesforce/apex/CopilotApexClass.updateCases';
import deleteCases from '@salesforce/apex/CopilotApexClass.deleteCases';
import { refreshApex } from '@salesforce/apex';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CopilotDemo extends NavigationMixin(LightningElement) {
    @track cases = [];
    @track error = null;
    @track isLoading = false;
    @track draftValues = [];
    wiredCasesResult;

    columns = [
        { label: 'Case Number', fieldName: 'recordLink', type: 'url', typeAttributes: { label: { fieldName: 'Id' }, target: '_self' } },
        { label: 'Subject', fieldName: 'Subject', type: 'text' },
        { label: 'Status', fieldName: 'Status', type: 'picklistColumn', editable: true },
        { label: 'Priority', fieldName: 'Priority', type: 'text', editable: false },
        {
            type: 'action',
            fixedWidth: 100,
            typeAttributes: {
                actions: [
                    { label: 'Edit', name: 'edit' },
                    { label: 'Delete', name: 'delete' }
                ]
            }
        }
    ];

    get caseCount() {
        return this.cases?.length || 0;
    }

    get isEmpty() {
        return !this.isLoading && !this.error && this.cases?.length === 0;
    }

    @wire(getCases)
    wiredCases(result) {
        this.isLoading = true;
        this.wiredCasesResult = result;
        const { error, data } = result;

        if (data) {
            // add a URL field for navigation in the datatable and stash raw cases
            const mapped = data.map(c => ({ ...c, recordLink: '/' + c.Id }));
            this.cases = mapped;
            this.casesRaw = mapped;
            // build status filter options
            const statuses = Array.from(new Set(mapped.map(c => c.Status).filter(Boolean)));
            this.statusOptions = [{ label: 'All', value: '' }, ...statuses.map(s => ({ label: s, value: s }))];
            this.error = null;
            this.isLoading = false;
        } else if (error) {
            this.error = this.formatErrorMessage(error);
            this.cases = [];
            this.isLoading = false;
        }
    }

    get displayedCases() {
        let list = this.casesRaw || this.cases || [];
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            list = list.filter(c => (c.Subject || '').toLowerCase().includes(term) || (c.Id || '').toLowerCase().includes(term));
        }
        if (this.statusFilter) {
            list = list.filter(c => c.Status === this.statusFilter);
        }
        return list;
    }

    handleSearchChange(e) {
        this.searchTerm = e.target.value;
    }

    handleStatusFilterChange(e) {
        this.statusFilter = e.detail.value;
    }

    handleCardAction(e) {
        const id = e.target.dataset.id;
        const action = e.target.dataset.action;
        const row = (this.cases || []).find(c => c.Id === id);
        if (action === 'edit') {
            this.handleEditCase(row);
        } else if (action === 'delete') {
            this.openDeleteModal(row);
        }
    }

    openDeleteModal(row) {
        this.selectedCaseToDelete = row;
        this.isDeleteModalOpen = true;
    }

    closeDeleteModal() {
        this.selectedCaseToDelete = null;
        this.isDeleteModalOpen = false;
    }

    confirmDelete() {
        if (!this.selectedCaseToDelete) return;
        const id = this.selectedCaseToDelete.Id;
        deleteCases({ caseId: id })
            .then(() => {
                this.showToast('Success', 'Case deleted successfully', 'success');
                this.closeDeleteModal();
                return refreshApex(this.wiredCasesResult);
            })
            .catch(error => {
                this.showToast('Error', this.formatErrorMessage(error), 'error');
                console.error(error);
            });
    }

    handleRowAction(event) {
        const action = event.detail.action.name;
        const row = event.detail.row;

        switch (action) {
            case 'edit':
                this.handleEditCase(row);
                break;
            case 'delete':
                this.handleDeleteCase(row);
                break;
            default:
                break;
        }
    }

    handleEditCase(row) {
        this.showToast('Info', `Edit functionality for case ${row.Id}`, 'info');
    }

    handleSave(event) {
        const updatedFields = event.detail.draftValues;
        const promises = updatedFields.map(field => {
            return updateCases({
                caseId: field.Id,
                newStatus: field.Status
            });
        });

        Promise.all(promises)
            .then(() => {
                this.draftValues = [];
                this.showToast('Success', 'Cases updated successfully', 'success');
                return refreshApex(this.wiredCasesResult);
            })
            .catch(error => {
                this.showToast('Error', this.formatErrorMessage(error), 'error');
                console.error(error);
            });
    }

    handleDeleteCase(row) {
        if (!confirm(`Are you sure you want to delete case ${row.Id}?`)) {
            return;
        }

        deleteCases({ caseId: row.Id })
            .then(() => {
                this.showToast('Success', 'Case deleted successfully', 'success');
                return refreshApex(this.wiredCasesResult);
            })
            .catch(error => {
                this.showToast('Error', this.formatErrorMessage(error), 'error');
                console.error(error);
            });
    }

    handleRefresh() {
        this.isLoading = true;
        refreshApex(this.wiredCasesResult)
            .then(() => {
                this.showToast('Success', 'Cases refreshed', 'success');
            })
            .catch(error => {
                this.showToast('Error', this.formatErrorMessage(error), 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleRetry() {
        this.error = null;
        this.handleRefresh();
    }

    formatErrorMessage(error) {
        if (Array.isArray(error?.body)) {
            return error.body.map(e => e.message).join(', ');
        }
        return error?.body?.message || 'An unexpected error occurred';
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
           title: title,
        message: message,
        variant: variant
        });
        this.dispatchEvent(event);
    }                               
}
