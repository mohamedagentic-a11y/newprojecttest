import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { submitClaim, fetchClaimById } from '../store/slices/baggageSlice';
import { clearSubmissionStatus, clearActiveClaimDetail, clearFetchError } from '../store/slices/baggageSlice';
import type { RootState, AppDispatch } from '../store/index';
import { useI18n } from '../i18n/index';

const translations = {
  en: {
    pageTitle: 'Baggage Claims & Tracking',
    fileNewClaim: 'File a New Claim',
    recentClaims: 'Recent Claims',
    bookingRef: 'Booking Reference (PNR)',
    bookingRefPlaceholder: 'e.g., XK7P9M',
    incidentType: 'Incident Type',
    incidentDescription: 'Incident Description',
    descriptionPlaceholder: 'Provide details about the incident...',
    uploadEvidence: 'Upload Evidence (Max 5MB)',
    cancel: 'Cancel',
    submitClaim: 'Submit Claim',
    viewDetails: 'View Details',
    downloadReport: 'Download Report',
    selectIncidentType: 'Select incident type',
    delayed: 'Delayed Baggage',
    damaged: 'Damaged Baggage',
    lost: 'Lost Baggage',
    pilfered: 'Pilfered Baggage',
    other: 'Other',
    submitting: 'Submitting...',
    submitSuccess: 'Your claim has been submitted successfully.',
    submitFailed: 'Failed to submit claim. Please try again.',
    noRecentClaims: 'No recent claims found.',
    claimId: 'Claim ID',
    status: 'Status',
    createdAt: 'Created At',
    pnr: 'PNR',
    type: 'Type',
    fetchingDetails: 'Fetching claim details...',
    fetchError: 'Failed to fetch claim details.',
    fileTooLarge: 'File exceeds 5MB limit.',
    fileSelected: 'File selected',
    noFileSelected: 'No file selected',
    close: 'Close',
    claimDetails: 'Claim Details',
    description: 'Description',
    timeline: 'Status Timeline',
    reportDownloaded: 'Report downloaded.',
    loadingDetails: 'Loading details...',
  },
  ar: {
    pageTitle: 'مطالبات الأمتعة والتتبع',
    fileNewClaim: 'تقديم مطالبة جديدة',
    recentClaims: 'المطالبات الأخيرة',
    bookingRef: 'رقم الحجز (PNR)',
    bookingRefPlaceholder: 'مثال: XK7P9M',
    incidentType: 'نوع الحادثة',
    incidentDescription: 'وصف الحادثة',
    descriptionPlaceholder: 'قدم تفاصيل حول الحادثة...',
    uploadEvidence: 'رفع الأدلة (الحد الأقصى 5 ميغابايت)',
    cancel: 'إلغاء',
    submitClaim: 'تقديم المطالبة',
    viewDetails: 'عرض التفاصيل',
    downloadReport: 'تنزيل التقرير',
    selectIncidentType: 'اختر نوع الحادثة',
    delayed: 'أمتعة متأخرة',
    damaged: 'أمتعة تالفة',
    lost: 'أمتعة مفقودة',
    pilfered: 'أمتعة منهوبة',
    other: 'أخرى',
    submitting: 'جارٍ التقديم...',
    submitSuccess: 'تم تقديم مطالبتك بنجاح.',
    submitFailed: 'فشل تقديم المطالبة. يرجى المحاولة مجدداً.',
    noRecentClaims: 'لا توجد مطالبات حديثة.',
    claimId: 'معرّف المطالبة',
    status: 'الحالة',
    createdAt: 'تاريخ الإنشاء',
    pnr: 'رقم الحجز',
    type: 'النوع',
    fetchingDetails: 'جارٍ جلب تفاصيل المطالبة...',
    fetchError: 'فشل جلب تفاصيل المطالبة.',
    fileTooLarge: 'حجم الملف يتجاوز الحد الأقصى 5 ميغابايت.',
    fileSelected: 'تم اختيار الملف',
    noFileSelected: 'لم يتم اختيار ملف',
    close: 'إغلاق',
    claimDetails: 'تفاصيل المطالبة',
    description: 'الوصف',
    timeline: 'الجدول الزمني للحالة',
    reportDownloaded: 'تم تنزيل التقرير.',
    loadingDetails: 'جارٍ تحميل التفاصيل...',
  },
};

const INCIDENT_TYPES = ['delayed', 'damaged', 'lost', 'pilfered', 'other'] as const;
type IncidentType = typeof INCIDENT_TYPES[number];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function BaggageClaims() {
  const { language, dir } = useI18n();
  const t = translations[language];
  const dispatch = useDispatch<AppDispatch>();

  const { claims, activeClaimDetail, submissionStatus, fetchStatus, submissionError, fetchError } =
    useSelector((state: RootState) => state.baggage);

  const [pnr, setPnr] = useState('');
  const [incidentType, setIncidentType] = useState<IncidentType | ''>('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (submissionStatus === 'succeeded') {
      setLocalSuccess(true);
      setPnr('');
      setIncidentType('');
      setDescription('');
      setFile(null);
      setFileError('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      const timer = setTimeout(() => {
        dispatch(clearSubmissionStatus());
        setLocalSuccess(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [submissionStatus, dispatch]);

  useEffect(() => {
    if (submissionStatus === 'failed') {
      const timer = setTimeout(() => {
        dispatch(clearSubmissionStatus());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [submissionStatus, dispatch]);

  useEffect(() => {
    if (fetchError) {
      const timer = setTimeout(() => {
        dispatch(clearFetchError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [fetchError, dispatch]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (selected) {
      if (selected.size > MAX_FILE_SIZE) {
        setFileError(t.fileTooLarge);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setFileError('');
      setFile(selected);
    }
  };

  const handleCancel = () => {
    setPnr('');
    setIncidentType('');
    setDescription('');
    setFile(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    dispatch(clearSubmissionStatus());
    setLocalSuccess(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnr || !incidentType || !description) return;

    const formData: { pnr: string; incidentType: string; description: string; file?: File } = {
      pnr,
      incidentType,
      description,
    };
    if (file) formData.file = file;

    dispatch(submitClaim(formData) as any);
  };

  const handleViewDetails = (claimId: string) => {
    dispatch(fetchClaimById(claimId) as any);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    dispatch(clearActiveClaimDetail());
  };

  const handleDownloadReport = (claimId: string) => {
    const claim = claims.find((c) => c.id === claimId);
    if (!claim) return;
    const content = JSON.stringify(claim, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claim_report_${claimId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isFormValid = pnr.trim() !== '' && incidentType !== '' && description.trim() !== '';
  const isSubmitting = submissionStatus === 'loading';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" dir={dir}>
      <div className="max-w-4xl mx-auto">
        {/* Page Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-start">
          {t.pageTitle}
        </h1>

        {/* File a New Claim */}
        <section className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-start">
            {t.fileNewClaim}
          </h2>

          {localSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-start">
              {t.submitSuccess}
            </div>
          )}

          {submissionStatus === 'failed' && submissionError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-start">
              {t.submitFailed}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* PNR */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-start">
                {t.bookingRef}
              </label>
              <input
                type="text"
                value={pnr}
                onChange={(e) => setPnr(e.target.value.toUpperCase())}
                placeholder={t.bookingRefPlaceholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-start"
                disabled={isSubmitting}
              />
            </div>

            {/* Incident Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-start">
                {t.incidentType}
              </label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType | '')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-start bg-white"
                disabled={isSubmitting}
              >
                <option value="">{t.selectIncidentType}</option>
                {INCIDENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t[type]}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-start">
                {t.incidentDescription}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.descriptionPlaceholder}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-start"
                disabled={isSubmitting}
              />
            </div>

            {/* File Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-start">
                {t.uploadEvidence}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="block w-full text-sm text-gray-500 file:me-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {fileError && (
                <p className="mt-1 text-sm text-red-600 text-start">{fileError}</p>
              )}
              {file && !fileError && (
                <p className="mt-1 text-sm text-gray-500 text-start">
                  {t.fileSelected}: {file.name}
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-start">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? t.submitting : t.submitClaim}
              </button>
            </div>
          </form>
        </section>

        {/* Recent Claims */}
        <section className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-start">
            {t.recentClaims}
          </h2>

          {fetchError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-start">
              {t.fetchError}
            </div>
          )}

          {claims.length === 0 ? (
            <p className="text-gray-500 text-start">{t.noRecentClaims}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 font-semibold text-gray-700 text-start pe-4">{t.claimId}</th>
                    <th className="pb-3 font-semibold text-gray-700 text-start pe-4">{t.pnr}</th>
                    <th className="pb-3 font-semibold text-gray-700 text-start pe-4">{t.type}</th>
                    <th className="pb-3 font-semibold text-gray-700 text-start pe-4">{t.status}</th>
                    <th className="pb-3 font-semibold text-gray-700 text-start pe-4">{t.createdAt}</th>
                    <th className="pb-3 font-semibold text-gray-700 text-start"></th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 pe-4 text-gray-800 font-mono">{claim.id}</td>
                      <td className="py-3 pe-4 text-gray-800">{claim.pnr}</td>
                      <td className="py-3 pe-4 text-gray-800">{claim.incidentType}</td>
                      <td className="py-3 pe-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          claim.status === 'resolved'
                            ? 'bg-green-100 text-green-700'
                            : claim.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : claim.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="py-3 pe-4 text-gray-600">
                        {claim.createdAt
                          ? new Date(claim.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB')
                          : '—'}
                      </td>
                      <td className="py-3 text-start">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(claim.id)}
                            disabled={fetchStatus === 'loading'}
                            className="px-3 py-1 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                          >
                            {t.viewDetails}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadReport(claim.id)}
                            className="px-3 py-1 text-xs rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors font-medium border border-gray-200"
                          >
                            {t.downloadReport}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4" dir={dir}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 text-start">{t.claimDetails}</h3>
              <button
                type="button"
                onClick={handleCloseDetails}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold leading-none"
                aria-label={t.close}
              >
                ×
              </button>
            </div>

            {fetchStatus === 'loading' && (
              <p className="text-gray-500 text-start">{t.loadingDetails}</p>
            )}

            {fetchStatus === 'failed' && (
              <p className="text-red-600 text-start">{t.fetchError}</p>
            )}

            {fetchStatus === 'succeeded' && activeClaimDetail && (
              <div className="space-y-3 text-sm text-gray-800">
                <div className="flex gap-2 text-start">
                  <span className="font-medium text-gray-600 min-w-[120px]">{t.claimId}:</span>
                  <span className="font-mono">{activeClaimDetail.id}</span>
                </div>
                <div className="flex gap-2 text-start">
                  <span className="font-medium text-gray-600 min-w-[120px]">{t.pnr}:</span>
                  <span>{activeClaimDetail.pnr}</span>
                </div>
                <div className="flex gap-2 text-start">
                  <span className="font-medium text-gray-600 min-w-[120px]">{t.type}:</span>
                  <span>{activeClaimDetail.incidentType}</span>
                </div>
                <div className="flex gap-2 text-start">
                  <span className="font-medium text-gray-600 min-w-[120px]">{t.status}:</span>
                  <span>{activeClaimDetail.status}</span>
                </div>
                <div className="flex gap-2 text-start">
                  <span className="font-medium text-gray-600 min-w-[120px]">{t.description}:</span>
                  <span>{activeClaimDetail.description}</span>
                </div>

                {activeClaimDetail.timeline && activeClaimDetail.timeline.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-700 mb-2 text-start">{t.timeline}</h4>
                    <ul className="space-y-2">
                      {activeClaimDetail.timeline.map((entry: { timestamp: string; event: string }, idx: number) => (
                        <li key={idx} className="flex gap-3 text-start">
                          <span className="text-gray-400 text-xs mt-0.5 min-w-[90px]">
                            {new Date(entry.timestamp).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB')}
                          </span>
                          <span className="text-gray-700">{entry.event}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleCloseDetails}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition-colors"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}