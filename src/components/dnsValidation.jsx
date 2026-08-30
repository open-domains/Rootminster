// Shared DNS validation rules — used client-side

export const RECORD_TYPES_BASE = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'];
export const RECORD_TYPES_NS_UNLOCKED = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];

// Record types where Cloudflare proxy is meaningful
export const PROXIABLE_TYPES = ['A', 'AAAA', 'CNAME'];

// Types that support multiple values on the same hostname
export const MULTI_VALUE_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS'];

export function validateSubdomainLabel(subdomain) {
  if (!subdomain) return 'Subdomain is required';
  if (subdomain.length > 63) return 'Subdomain must be 63 characters or fewer';
  if (!/^[a-z0-9][a-z0-9\-_\.~]*$/.test(subdomain) && !/^[a-z0-9]$/.test(subdomain)) {
    return 'Only lowercase letters, numbers, hyphens, underscores, dots, and tildes allowed.';
  }
  return null;
}

export function validateRecordValue(type, value) {
  if (!value || !value.trim()) return 'Record value is required';
  const v = value.trim();

  switch (type) {
    case 'A': {
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return 'A record requires a valid IPv4 address (e.g. 1.2.3.4)';
      if (v.split('.').map(Number).some(p => p > 255)) return 'IPv4 octets must be 0–255';
      return null;
    }
    case 'AAAA': {
      if (!/^[0-9a-fA-F:]+$/.test(v) || !v.includes(':')) return 'AAAA requires a valid IPv6 address';
      return null;
    }
    case 'CNAME': {
      if (v.includes(' ')) return 'CNAME target must be a hostname without spaces';
      if (!/^[a-zA-Z0-9._-]+$/.test(v)) return 'CNAME target contains invalid characters';
      // Reject IP addresses
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return 'CNAME target must be a hostname, not an IP address';
      if (/^[0-9a-fA-F:]+$/.test(v) && v.includes(':')) return 'CNAME target must be a hostname, not an IP address';
      // Reject nameserver-style hostnames
      if (/(^|\.)ns\d*\./.test(v.toLowerCase()) || /^ns\d*\./i.test(v)) return 'CNAME cannot point to a nameserver (ns) hostname';
      return null;
    }
    case 'MX': {
      // Accept "10 mail.example.com" or just "mail.example.com" (priority auto-assigned to 10)
      const hasPriority = /^(\d+)\s+(.+)$/.test(v);
      if (hasPriority) {
        const priority = parseInt(v.split(' ')[0]);
        if (priority < 0 || priority > 65535) return 'MX priority must be 0–65535';
      } else if (!/^[a-zA-Z0-9._-]+$/.test(v)) {
        return 'MX requires a valid mail server hostname (e.g. "mail.example.com" or "10 mail.example.com")';
      }
      return null;
    }
    case 'TXT': {
      if (v.length > 2048) return 'TXT record value is too long (max 2048 chars)';
      const alphanumCount = (v.match(/[a-zA-Z0-9]/g) || []).length;
      if (alphanumCount < 6) return 'TXT record must contain at least 6 letters or numbers';
      return null;
    }
    case 'NS': {
      const nsv = v.replace(/\.$/, ''); // strip trailing dot
      if (!/^[a-zA-Z0-9._-]+$/.test(nsv)) return 'NS nameserver must be a valid hostname (e.g. ns1.provider.com)';
      if (!nsv.includes('.')) return 'NS nameserver must be a fully qualified domain name (e.g. ns1.provider.com)';
      if (nsv.startsWith('-') || nsv.endsWith('-')) return 'NS hostname cannot start or end with a hyphen';
      return null;
    }
    default:
      return null;
  }
}

export function getRecordValuePlaceholder(type) {
  switch (type) {
    case 'A': return '1.2.3.4';
    case 'AAAA': return '2606:4700:4700::1111';
    case 'CNAME': return 'target.example.com';
    case 'MX': return 'mail.example.com  (or "10 mail.example.com")';
    case 'TXT': return 'v=spf1 include:example.com ~all';
    case 'NS': return 'ns1.provider.com';
    default: return '';
  }
}

export function getRecordTypeHint(type) {
  switch (type) {
    case 'A': return 'Points to an IPv4 address. Multiple A records allowed for redundancy.';
    case 'AAAA': return 'Points to an IPv6 address. Multiple records allowed.';
    case 'CNAME': return 'Alias to another hostname. Cannot be combined with other record types.';
    case 'MX': return 'Mail server hostname. Priority is optional — defaults to 10 if omitted. Multiple allowed.';
    case 'TXT': return 'Arbitrary text. Used for SPF, DKIM, domain verification, etc.';
    case 'NS': return 'Delegates this subdomain to another nameserver. Requires £2+ donation unlock.';
    default: return '';
  }
}