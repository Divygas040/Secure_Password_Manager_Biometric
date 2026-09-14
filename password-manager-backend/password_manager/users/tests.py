import json
import re
from datetime import timedelta
from io import BytesIO
from time import time
from unittest.mock import patch

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image as PILImage
from rest_framework.test import APIClient

from .fields import Ciphertext, decrypt
from .models import CustomUser, Password, BiometricTemplate, RateLimitBucket, Image
from .biometrics import extract_encoding

PASS = 'Unit-test-password!42'

@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class SecurityTests(TestCase):
    def setUp(self):
        self.a = CustomUser.objects.create_user('alice', email='alice@example.invalid', phone='12345678901', password=PASS)
        self.b = CustomUser.objects.create_user('bob', email='bob@example.invalid', phone='12345678902', password=PASS)
        self.client = APIClient()
        self.login()

    def login(self, client=None, email='alice@example.invalid'):
        client = client or self.client
        result = client.post('/api/users/login/', {'email':email, 'password':PASS}, format='json')
        self.assertEqual(result.status_code, 200)
        self.assertNotIn('token', result.data)
        self.assertNotIn('refresh', result.data)
        return result

    def unlock(self, client=None):
        client = client or self.client
        self.assertEqual(client.post('/api/users/send-otp-email/').status_code, 200)
        code = re.search(r'\b\d{6}\b', mail.outbox[-1].body).group()
        self.assertEqual(client.post('/api/users/verify-otp/', {'otp':code}).status_code, 200)
        return code

    def new_password(self, user=None, value='vault test credential'):
        return Password.objects.create(user=user or self.a, domain_name='Example', password=value, link='https://example.com')

    def test_signup_hashes_login_password_and_requires_strong_password(self):
        data = {'username':'charlie', 'phone':'12345678903', 'email':'CHARLIE@example.invalid', 'password':PASS}
        result = self.client.post('/api/users/signup/', data, format='json')
        self.assertEqual(result.status_code, 201)
        user = CustomUser.objects.get(username='charlie')
        self.assertTrue(user.check_password(PASS))
        self.assertNotEqual(user.password, PASS)
        self.assertEqual(user.email, data['email'].lower())
        data.update(username='weak', phone='12345678904', email='weak@example.invalid', password='password')
        self.assertEqual(self.client.post('/api/users/signup/',data).status_code,400)

    def test_duplicate_email_case_insensitive(self):
        r = self.client.post('/api/users/signup/', {'username':'new', 'phone':'12345678903', 'email':'ALICE@example.invalid', 'password':PASS})
        self.assertEqual(r.status_code,400)

    def test_login_cookie_and_logout_revocation(self):
        cookie = self.client.cookies[settings.SESSION_COOKIE_NAME]
        self.assertTrue(cookie['httponly'])
        saved = cookie.value
        self.unlock()
        self.assertEqual(self.client.post('/api/users/logout/').status_code,200)
        self.client.cookies[settings.SESSION_COOKIE_NAME] = saved
        self.assertEqual(self.client.get('/api/users/me/').status_code,401)

    def test_session_absolute_expiry(self):
        session=self.client.session;session['login_at']=time()-13*3600;session.save()
        self.assertEqual(self.client.get('/api/users/me/').status_code,401)

    def test_inactive_and_wrong_password_rejected(self):
        r=self.client.post('/api/users/login/',{'email':self.a.email,'password':'wrong'})
        self.assertEqual(r.status_code,401)
        self.a.is_active=False;self.a.save()
        r=self.client.post('/api/users/login/',{'email':self.a.email,'password':PASS})
        self.assertEqual(r.status_code,401)

    def test_anonymous_endpoints_reject_access(self):
        anon=APIClient()
        for url in ['passwords/','me/','image/']:
            self.assertEqual(anon.get('/api/users/'+url).status_code,401)
        for url in ['image-upload/','verify-face/','send-otp-email/','verify-otp/']:
            self.assertEqual(anon.post('/api/users/'+url).status_code,401)

    def test_locked_vault_requires_server_verification(self):
        self.new_password()
        self.assertEqual(self.client.get('/api/users/passwords/').status_code,403)
        self.assertEqual(self.client.post('/api/users/passwords/',{'domain_name':'x','password':'x'}).status_code,403)

    def test_database_ciphertext_authorized_retrieval(self):
        self.unlock()
        r=self.client.post('/api/users/passwords/', {'domain_name':'Example','password':'exact secret value','link':'https://example.com'})
        self.assertEqual(r.status_code,201)
        self.assertNotIn('password',r.data)
        with connection.cursor() as cursor:
            cursor.execute('SELECT password FROM users_password WHERE id = %s',[r.data['id']])
            raw=cursor.fetchone()[0]
        self.assertNotEqual(raw,'exact secret value')
        self.assertNotIn('exact secret value',raw)
        r=self.client.get('/api/users/passwords/')
        self.assertEqual(r.data[0]['password'],'exact secret value')
        self.assertEqual(r['Cache-Control'],'no-store, private')

    def test_cross_user_crud_isolated(self):
        other=self.new_password(self.b)
        self.unlock()
        self.assertEqual(self.client.get('/api/users/passwords/').data,[])
        url=f'/api/users/passwords/{other.pk}/'
        for method, kwargs in [('get',{}),('patch',{'data':{'password':'altered'},'format':'json'}),('delete',{})]:
            self.assertEqual(getattr(self.client,method)(url,**kwargs).status_code,404)
        other.refresh_from_db();self.assertEqual(decrypt(other.password),'vault test credential')

    def test_update_encrypts_and_metadata_save_does_not_double_encrypt(self):
        p=self.new_password();p.refresh_from_db();cipher=p.password
        p.domain_name='updated';p.save();p.refresh_from_db();self.assertEqual(p.password,cipher)
        self.unlock();r=self.client.patch(f'/api/users/passwords/{p.pk}/',{'password':'changed'},format='json')
        self.assertEqual(r.status_code,200);p.refresh_from_db();self.assertEqual(decrypt(p.password),'changed')

    def test_ciphertext_looking_plaintext_is_not_accepted_as_pre_encrypted(self):
        value='fernet:v1:literal-user-password'
        p=self.new_password(value=value);p.refresh_from_db();self.assertEqual(decrypt(p.password),value)

    def test_bulk_and_queryset_writes_encrypt(self):
        Password.objects.bulk_create([Password(user=self.a,domain_name='bulk',password='bulk-secret')])
        Password.objects.filter(user=self.a).update(password='updated-secret')
        p=Password.objects.get(user=self.a);self.assertEqual(decrypt(p.password),'updated-secret')
        self.assertNotEqual(p.password,'updated-secret')

    def test_wrong_key_and_tampering_fail_closed(self):
        p=self.new_password();p.refresh_from_db()
        with override_settings(VAULT_ENCRYPTION_KEY=Fernet.generate_key().decode()):
            with self.assertRaises(InvalidToken):decrypt(p.password)
        with self.assertRaises(InvalidToken):decrypt(Ciphertext(str(p.password)[:-8]+'invalid!'))

    def test_otp_hash_expiry_one_time_and_post_only(self):
        self.assertEqual(self.client.get('/api/users/send-otp-email/').status_code,405)
        self.assertEqual(self.client.get('/api/users/verify-otp/').status_code,405)
        self.assertEqual(self.client.post('/api/users/send-otp-email/').status_code,200)
        code=re.search(r'\b\d{6}\b',mail.outbox[-1].body).group()
        self.a.refresh_from_db();self.assertNotEqual(self.a.otp_digest,code)
        self.assertIsNone(self.a.otp_generated)
        self.a.otp_expires_at=timezone.now()-timedelta(seconds=1);self.a.save()
        self.assertEqual(self.client.post('/api/users/verify-otp/',{'otp':code}).status_code,400)
        self.a.otp_expires_at=timezone.now()+timedelta(seconds=60);self.a.save()
        self.assertEqual(self.client.post('/api/users/verify-otp/',{'otp':code}).status_code,200)
        self.assertEqual(self.client.post('/api/users/verify-otp/',{'otp':code}).status_code,400)
        self.a.refresh_from_db();self.assertEqual(self.a.otp_digest,'')

    def test_otp_cooldown_attempt_lockout_and_session_binding(self):
        self.assertEqual(self.client.post('/api/users/send-otp-email/').status_code,200)
        self.assertEqual(self.client.post('/api/users/send-otp-email/').status_code,429)
        code=re.search(r'\b\d{6}\b',mail.outbox[-1].body).group()
        other=APIClient();self.login(other)
        self.assertEqual(other.post('/api/users/verify-otp/',{'otp':code}).status_code,400)
        wrong='000000' if code!='000000' else '111111'
        for _ in range(4):self.assertEqual(self.client.post('/api/users/verify-otp/',{'otp':wrong}).status_code,400)
        self.assertEqual(self.client.post('/api/users/verify-otp/',{'otp':code}).status_code,400)

    def test_email_failure_does_not_leak_details_or_leave_code(self):
        with patch('users.views.send_mail',side_effect=RuntimeError('private transport details')):
            r=self.client.post('/api/users/send-otp-email/')
        self.assertEqual(r.status_code,503);self.assertNotIn('private',str(r.data))
        self.a.refresh_from_db();self.assertEqual(self.a.otp_digest,'')

    def test_vault_grant_expiry_and_lock(self):
        self.unlock();session=self.client.session;session['vault_until']=time()-1;session.save()
        self.assertEqual(self.client.get('/api/users/passwords/').status_code,403)
        session=self.client.session;session['vault_until']=time()+300;session.save()
        self.assertEqual(self.client.post('/api/users/lock/').status_code,200)
        self.assertEqual(self.client.get('/api/users/passwords/').status_code,403)

    def test_enrollment_requires_otp_and_stores_encrypted_template_only(self):
        image=lambda:SimpleUploadedFile('face.png',b'dummy')
        self.assertEqual(self.client.post('/api/users/image-upload/',{'image':image()}).status_code,403)
        self.unlock()
        with patch('users.biometrics.extract_encoding',return_value=[0.1]*128):
            self.assertEqual(self.client.post('/api/users/image-upload/',{'image':image()}).status_code,201)
        template=BiometricTemplate.objects.get(user=self.a)
        self.assertNotIn('[0.1',template.encoding)
        self.assertEqual(json.loads(decrypt(template.encoding,'BIOMETRIC_ENCRYPTION_KEY')),[0.1]*128)
        self.assertFalse(Image.objects.exists())
        self.assertEqual(self.client.get('/api/users/image/').data,{'enrolled':True})

    def test_face_failure_does_not_unlock_or_expose_passwords(self):
        self.new_password();BiometricTemplate.objects.create(user=self.a,encoding=json.dumps([0.1]*128))
        with patch('users.biometrics.extract_encoding',return_value=[1.0]*128):
            r=self.client.post('/api/users/verify-face/',{'image':SimpleUploadedFile('x.png',b'dummy')})
        self.assertEqual(r.status_code,400);self.assertNotIn('password',r.data)
        self.assertEqual(self.client.get('/api/users/passwords/').status_code,403)

    def test_face_success_unlocks_own_vault_but_cannot_replace_enrollment(self):
        BiometricTemplate.objects.create(user=self.a,encoding=json.dumps([0.1]*128))
        self.new_password();self.new_password(self.b)
        with patch('users.biometrics.extract_encoding',return_value=[0.1]*128):
            r=self.client.post('/api/users/verify-face/',{'image':SimpleUploadedFile('x.png',b'dummy')})
        self.assertEqual(r.status_code,200)
        self.assertEqual(len(self.client.get('/api/users/passwords/').data),1)
        self.assertEqual(self.client.post('/api/users/image-upload/').status_code,403)

    def test_face_does_not_use_other_users_template(self):
        BiometricTemplate.objects.create(user=self.b,encoding=json.dumps([0.1]*128))
        self.assertEqual(self.client.post('/api/users/verify-face/').status_code,404)

    def test_real_detector_rejects_blank_image(self):
        out=BytesIO();PILImage.new('RGB',(64,64)).save(out,format='PNG')
        with self.assertRaisesMessage(Exception,'exactly one'):
            extract_encoding(SimpleUploadedFile('blank.png',out.getvalue()))

    def test_image_size_content_and_pixel_validation(self):
        for upload in [None,SimpleUploadedFile('bad.png',b'not an image'),SimpleUploadedFile('big.png',b'x'*(2*1024*1024+1))]:
            with self.assertRaises(Exception):extract_encoding(upload)
        out=BytesIO();PILImage.new('RGB',(2100,2100)).save(out,format='PNG')
        with self.assertRaises(Exception):extract_encoding(SimpleUploadedFile('pixels.png',out.getvalue()))

    def test_login_rate_limit(self):
        for _ in range(10):
            result=self.client.post('/api/users/login/',{'email':'nobody@example.invalid','password':'wrong'})
        self.assertEqual(result.status_code,429)

    def test_health_minimal_public_response(self):
        r=APIClient().get('/health/');self.assertEqual(r.status_code,200);self.assertEqual(r.json(),{'status':'ok'})

    def test_legacy_readiness_guard(self):
        Image.objects.create(user=self.a,image_data=b'legacy')
        with self.assertRaises(CommandError):call_command('check_data_ready')

    def test_csrf_login_and_authenticated_mutations(self):
        client=APIClient(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/users/login/',{'email':self.a.email,'password':PASS}).status_code,403)
        token=client.get('/api/users/csrf/').data['csrfToken']
        r=client.post('/api/users/login/',{'email':self.a.email,'password':PASS},HTTP_X_CSRFTOKEN=token)
        self.assertEqual(r.status_code,200)
        self.assertEqual(client.post('/api/users/send-otp-email/').status_code,403)
        token=client.get('/api/users/csrf/').data['csrfToken']
        self.assertEqual(client.post('/api/users/send-otp-email/',HTTP_X_CSRFTOKEN=token,HTTP_ORIGIN='https://evil.example').status_code,403)
        self.assertEqual(client.post('/api/users/send-otp-email/',HTTP_X_CSRFTOKEN=token).status_code,200)

    def test_cookie_security_and_cors(self):
        with override_settings(SESSION_COOKIE_SECURE=True,CSRF_COOKIE_SECURE=True,SESSION_COOKIE_SAMESITE='None'):
            r=self.login();cookie=r.cookies[settings.SESSION_COOKIE_NAME]
            self.assertTrue(cookie['secure']);self.assertTrue(cookie['httponly']);self.assertEqual(cookie['samesite'],'None')
        r=self.client.get('/api/users/me/',HTTP_ORIGIN='https://evil.example')
        self.assertNotIn('Access-Control-Allow-Origin',r)
        r=self.client.get('/api/users/me/',HTTP_ORIGIN='http://localhost:3000')
        self.assertEqual(r['Access-Control-Allow-Origin'],'http://localhost:3000')
        self.assertEqual(r['Access-Control-Allow-Credentials'],'true')
