import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLanguage } from '../i18n/LanguageContext';
import type { AppDispatch, RootState } from '../store/store';
import {
  submitClaimThunk,
  fetchClaim,
  clearActiveClaim,
  clearSubmissionStatus,
  setActiveClaim,
} from '../store/baggageSlice';
import type { IncidentType, BaggageClaimEntity } from '../store/baggageSlice';

const strings = {
  en: {
    pageTitle: 'Baggage Claims & Tracking',
    fileClaimHeading: 'File a New Claim',
    recentClaimsHeading: 'Recent Claims',
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
    delayed: 'Delayed',
    damaged: 'Damaged',
    lost: 'Lost',
    other: 'Other',
    requiredField: 'This field is required.',
    invalidFileFormat: 'Only image files are allowed (jpg, jpeg, png, gif, webp).',
    fileTooLarge: 'File size must not exceed 5MB.',
    submitting: 'Submitting...',
    submissionSuccess: 'Claim submitted successfully! Tracking ID:',
    submissionError: 'Submission failed. Please try again.',
    trackingId: 'Tracking ID',
    status: 'Status',
    createdAt: 'Created At',
    timeline: 'Status Timeline',
    noClaims: 'No recent claims found.',
    fetchError: 'Failed to load claim details.',
    loading: 'Loading...',
    chooseFiles: 'Choose Files',
    noFilesChosen: 'No files chosen',
    filesSelected: (n: number) => `${n} file${n !== 1 ? 's' : ''} selected`,
    pnrError: 'Booking reference is required.',
    descriptionError: 'Incident description is required.',
    incidentTypeError: 'Incident type is required.',
  },
  ar: {
    pageTitle: 'مطالبات الأمتعة والتتبع',
    fileClaimHeading: 'تقديم مطالبة جديدة',
    recentClaimsHeading: 'المطالبات الأخيرة',
    bookingRef: 'مرجع الحجز (PNR)',
    bookingRefPlaceholder: 'مثال: XK7P9M',
    incidentType: 'نوع الحادثة',
    incidentDescription: 'وصف الحادثة',
    descriptionPlaceholder: 'يرجى تقديم تفاصيل حول الحادثة...',
    uploadEvidence: 'رفع الأدلة (الحد الأقصى 5 ميغابايت)',
    cancel: 'إلغاء',
    submitClaim: 'تقديم المطالبة',
    viewDetails: 'عرض التفاصيل',
    downloadReport: 'تنزيل التقرير',
    selectIncidentType: 'اختر نوع الحادثة',
    delayed: 'متأخرة',
    damaged: 'تالفة',
    lost: 'مفقودة',
    other: 'أخرى',
    requiredField: 'هذا الحقل مطلوب.',
    invalidFileFormat: 'يُسمح بملفات الصور فقط (jpg، jpeg، png، gif، webp).',
    fileTooLarge: 'يجب ألا يتجاوز حجم الملف 5 ميغابايت.',
    submitting: 'جارٍ الإرسال...',
    submissionSuccess: 'تم تقديم المطالبة بنجاح! معرف التتبع:',
    submissionError: 'فشل الإرسال. يرجى المحاولة مرة أخرى.',
    trackingId: 'معرف التتبع',
    status: 'الحالة',
    createdAt: 'تاريخ الإنشاء',
    timeline: 'الجدول الزمني للحالة',
    noClaims: 'لم يتم العثور على مطالبات حديثة.',
    fetchError: 'فشل تحميل تفاصيل المطالبة.',
    loading: 'جارٍ التحميل...',
    chooseFiles: 'اختر الملفات',
    noFilesChosen: 'لم يتم اختيار ملفات',
    filesSelected: (n: number) => `تم اختيار ${n} ملف${n !== 1 ? 'ات' : ''}`,
    pnrError: 'مرجع الحجز مطلوب.',
    descriptionError: 'وصف الحادثة مطلوب.',
    incidentTypeError: 'نوع الحادثة مطلوب.',
  },
};

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface FormErrors {
  pnr?: string;
  incidentType?: string;
  description?: string;
  files?: string;
}

export function BaggageClaims() {
  const { lang } = useLanguage();
  const t = strings[lang as 'en' | 'ar'] ?? strings.en;
  const dispatch = useDispatch<AppDispatch>();

  const { claims, activeClaim, submissionStatus, fetchStatus, submissionError, lastSubmittedId } =
    useSelector((state: RootState) => state.baggage);

  const [pnr, setPnr] = useState('');
  const [incidentType, setIncidentType] = useState<IncidentType | ''>('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      dispatch(clearSubmissionStatus());
      dispatch(clearActiveClaim());
    };
  }, [dispatch]);

  useEffect(() => {
    if (submissionStatus === 'succeeded' && lastSubmittedId) {
      resetForm();
    }
  }, [submissionStatus, lastSubmittedId]);

  function resetForm() {
    setPnr('');
    setIncidentType('');
    setDescription('');
    setFiles([]);
    setFormErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function validateForm(): boolean {
    const errors: FormErrors = {};
    if (!pnr.trim()) errors.pnr = t.pnrError;
    if (!incidentType) errors.incidentType = t.incidentTypeError;
    if (!description.trim()) errors.description = t.descriptionError;

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.files = t.invalidFileFormat;
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.files = t.fileTooLarge;
        break;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const errors: FormErrors = {};
    for (const file of selected) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.files = t.invalidFileFormat;
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.files = t.fileTooLarge;
        break;
      }
    }
    setFormErrors((prev) => ({ ...prev, files: errors.files }));
    if (!errors.files) setFiles(selected);
    else {
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    const fileStrings = await Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    );

    dispatch(
      submitClaimThunk({
        pnr: pnr.trim(),
        incidentType: incidentType as IncidentType,
        description: description.trim(),
        files: fileStrings,
      })
    );
  }

  function handleCancel() {
    resetForm();
    dispatch(clearSubmissionStatus());
  }

  async function handleViewDetails(claim: BaggageClaimEntity) {
    if (showDetails === claim.id) {
      setShowDetails(null);
      dispatch(clearActiveClaim());
    } else {
      setShowDetails(claim.id);
      dispatch(setActiveClaim(claim));
      dispatch(fetchClaim(claim.id));
    }
  }

  function handleDownloadReport(claim: BaggageClaimEntity) {
    const lines = [
      `Tracking ID: ${claim.trackingId}`,
      `PNR: ${claim.pnr}`,
      `Incident Type: ${claim.incidentType}`,
      `Description: ${claim.description}`,
      `Status: ${claim.status}`,
      `Created At: ${claim.createdAt}`,
      '',
      'Timeline:',
      ...claim.timeline.map(
        (ev) => `  [${ev.timestamp}] ${ev.status}: ${ev.description}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claim-${claim.trackingId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isSubmitting = submissionStatus === 'loading';
  const submitDisabled = isSubmitting;

  const incidentTypeOptions: { value: IncidentType; label: string }[] = [
    { value: 'delayed' as IncidentType, label: t.delayed },
    { value: 'damaged' as IncidentType, label: t.damaged },
    { value: 'lost' as IncidentType, label: t.lost },
    { value: 'other' as IncidentType, label: t.other },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page Heading */}
        <h1 className="text-3xl font-bold text-gray-900">{t.pageTitle}</h1>

        {/* File a New Claim */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">{t.fileClaimHeading}</h2>

          {submissionStatus === 'succeeded' && lastSubmittedId && (
            <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
              {t.submissionSuccess}{' '}
              <span className="font-mono font-bold">{lastSubmittedId}</span>
            </div>
          )}

          {submissionStatus === 'failed' && submissionError && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
              {t.submissionError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Booking Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.bookingRef}
              </label>
              <input
                type="text"
                value={pnr}
                onChange={(e) => setPnr(e.target.value)}
                placeholder={t.bookingRefPlaceholder}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formErrors.pnr ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {formErrors.pnr && (
                <p className="mt-1 text-xs text-red-600">{formErrors.pnr}</p>
              )}
            </div>

            {/* Incident Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.incidentType}
              </label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                  formErrors.incidentType ? 'border-red-400' : 'border-gray-300'
                }`}
              >
                <option value="">{t.selectIncidentType}</option>
                {incidentTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {formErrors.incidentType && (
                <p className="mt-1 text-xs text-red-600">{formErrors.incidentType}</p>
              )}
            </div>

            {/* Incident Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.incidentDescription}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.descriptionPlaceholder}
                rows={4}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                  formErrors.description ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {formErrors.description && (
                <p className="mt-1 text-xs text-red-600">{formErrors.description}</p>
              )}
            </div>

            {/* Upload Evidence */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.uploadEvidence}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {t.chooseFiles}
                </button>
                <span className="text-sm text-gray-500">
                  {files.length === 0
                    ? t.noFilesChosen
                    : t.filesSelected(files.length)}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {formErrors.files && (
                <p className="mt-1 text-xs text-red-600">{formErrors.files}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={submitDisabled}
                className="px-5 py-2 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {isSubmitting ? t.submitting : t.submitClaim}
              </button>
            </div>
          </form>
        </section>

        {/* Recent Claims */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">{t.recentClaimsHeading}</h2>

          {claims.length === 0 ? (
            <p className="text-sm text-gray-500">{t.noClaims}</p>
          ) : (
            <div className="space-y-4">
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  className="border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-800">
                        <span className="text-gray-500">{t.trackingId}:</span>{' '}
                        <span className="font-mono">{claim.trackingId}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="text-gray-500">{t.status}:</span>{' '}
                        <span className="capitalize">{claim.status}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="text-gray-500">{t.createdAt}:</span>{' '}
                        {new Date(claim.createdAt).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewDetails(claim)}
                        className="px-4 py-2 rounded-lg border border-blue-500 text-blue-600 text-sm hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {t.viewDetails}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadReport(claim)}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
                      >
                        {t.downloadReport}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {showDetails === claim.id && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      {fetchStatus === 'loading' ? (
                        <p className="text-sm text-gray-500">{t.loading}</p>
                      ) : fetchStatus === 'failed' ? (
                        <p className="text-sm text-red-500">{t.fetchError}</p>
                      ) : activeClaim ? (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3">
                            {t.timeline}
                          </h3>
                          {activeClaim.timeline.length === 0 ? (
                            <p className="text-sm text-gray-500">{t.noClaims}</p>
                          ) : (
                            <ol className="relative border-s border-gray-200 space-y-4 ms-3">
                              {activeClaim.timeline.map((event, idx) => (
                                <li key={idx} className="ms-4">
                                  <div className="absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-blue-500" />
                                  <p className="text-xs text-gray-400">
                                    {new Date(event.timestamp).toLocaleString(
                                      lang === 'ar' ? 'ar-SA' : 'en-US'
                                    )}
                                  </p>
                                  <p className="text-sm font-medium text-gray-700 capitalize">
                                    {event.status}
                                  </p>
                                  <p className="text-sm text-gray-600">{event.description}</p>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default BaggageClaims;