import { faCheckCircle, faExclamationTriangle, faInfoCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert } from '@mantine/core';
import { useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import getLoginAlert, { LoginAlertData } from '../api/auth/getLoginAlert.ts';

export default function LoginDemoAlert() {
  const { addToast } = useToast();
  const { language } = useTranslations();
  const [data, setData] = useState<LoginAlertData | null>(null);

  useEffect(() => {
    getLoginAlert()
      .then(setData)
      .catch((err) => addToast(httpErrorToHuman(err), 'error'));
  }, []);

  if (!data || !data.enabled) {
    return null;
  }

  const currentLang = language || 'en';
  const title = (data.title_translations && data.title_translations[currentLang]) || data.title || '';

  const message = (data.message_translations && data.message_translations[currentLang]) || data.message || '';

  if (!title && !message) {
    return null;
  }

  const icon =
    data.style === 'warning'
      ? faExclamationTriangle
      : data.style === 'error'
        ? faTimesCircle
        : data.style === 'success'
          ? faCheckCircle
          : faInfoCircle;

  const color =
    data.style === 'warning' ? 'yellow' : data.style === 'error' ? 'red' : data.style === 'success' ? 'green' : 'blue';

  return (
    <div className='w-full mb-4'>
      <Alert icon={<FontAwesomeIcon icon={icon} />} color={color} title={title || undefined}>
        <span className='whitespace-pre-wrap'>{message}</span>
      </Alert>
    </div>
  );
}
