import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export const api = {
  // Generic methods
  get: (url, config) => axios.get(`${API_URL}${url}`, config),
  post: (url, data, config) => axios.post(`${API_URL}${url}`, data, config),
  put: (url, data, config) => axios.put(`${API_URL}${url}`, data, config),
  delete: (url, config) => axios.delete(`${API_URL}${url}`, config),
  
  auth: {
    changePassword: (data) => axios.put(`${API_URL}/auth/change-password`, data),
  },
  users: {
    getAll: () => axios.get(`${API_URL}/users`),
    create: (data) => axios.post(`${API_URL}/users`, data),
    update: (id, data) => axios.put(`${API_URL}/users/${id}`, data),
    delete: (id) => axios.delete(`${API_URL}/users/${id}`),
    resetPassword: (id, data) => axios.put(`${API_URL}/users/${id}/reset-password`, data),
  },
  members: {
    getAll: () => axios.get(`${API_URL}/members`),
    create: (data) => axios.post(`${API_URL}/members`, data),
    update: (id, data) => axios.put(`${API_URL}/members/${id}`, data),
    delete: (id) => axios.delete(`${API_URL}/members/${id}`),
  },
  fineTypes: {
    getAll: () => axios.get(`${API_URL}/fine-types`),
    create: (data) => axios.post(`${API_URL}/fine-types`, data),
    update: (id, data) => axios.put(`${API_URL}/fine-types/${id}`, data),
    delete: (id) => axios.delete(`${API_URL}/fine-types/${id}`),
  },
  fines: {
    getAll: (fiscalYear) => axios.get(`${API_URL}/fines`, { params: { fiscal_year: fiscalYear } }),
    create: (data) => axios.post(`${API_URL}/fines`, data),
    update: (id, data) => axios.put(`${API_URL}/fines/${id}`, data),
    delete: (id) => axios.delete(`${API_URL}/fines/${id}`),
  },
  statistics: {
    getByFiscalYear: (fiscalYear) => axios.get(`${API_URL}/statistics`, { params: { fiscal_year: fiscalYear } }),
    getPersonal: (fiscalYear) => axios.get(`${API_URL}/statistics/personal`, { params: { fiscal_year: fiscalYear } }),
  },
  fiscalYears: {
    getAll: () => axios.get(`${API_URL}/fiscal-years`),
  },
  auditLogs: {
    getAll: (limit = 500) => axios.get(`${API_URL}/audit-logs`, { params: { limit } }),
  },
  events: {
    getAll: () => axios.get(`${API_URL}/events`),
    create: (data) => axios.post(`${API_URL}/events`, data),
    update: (id, data) => axios.put(`${API_URL}/events/${id}`, data),
    delete: (id) => axios.delete(`${API_URL}/events/${id}`),
    respond: (id, data) => axios.post(`${API_URL}/events/${id}/respond`, data),
    checkFines: () => axios.post(`${API_URL}/events/check-fines`),
    toggleFine: (id, data) => axios.put(`${API_URL}/events/${id}/fine-toggle`, data || {}),
  },
  ics: {
    getSettings: () => axios.get(`${API_URL}/settings/ics`),
    updateSettings: (data) => axios.put(`${API_URL}/settings/ics`, data),
    sync: () => axios.post(`${API_URL}/settings/ics/sync`),
  },
};