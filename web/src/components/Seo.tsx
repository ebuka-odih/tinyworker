import React from 'react';
import { useLocation } from 'react-router-dom';

type SeoConfig = {
  title: string;
  description: string;
  robots: string;
  path: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
};

const SITE_URL = 'https://tinyworker.vercel.app';
const SOCIAL_IMAGE_URL = `${SITE_URL}/social-card.png`;

function ensureMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element!.setAttribute(key, value);
  });
}

function ensureLink(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLLinkElement>(selector);

  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element!.setAttribute(key, value);
  });
}

function ensureStructuredData(jsonLd?: SeoConfig['jsonLd']) {
  const scriptId = 'tinyfinder-seo-jsonld';
  const existing = document.getElementById(scriptId);

  if (!jsonLd) {
    existing?.remove();
    return;
  }

  const script = existing ?? document.createElement('script');
  script.id = scriptId;
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(jsonLd);

  if (!existing) {
    document.head.appendChild(script);
  }
}

function buildSeoConfig(pathname: string): SeoConfig {
  if (pathname === '/') {
    return {
      title: 'TinyFinder | Jobs, Scholarships, Grants & Visa Search',
      description:
        'Search jobs, scholarships, grants, and visa pathways faster with TinyFinder’s guided opportunity search workspace.',
      robots: 'index, follow, max-image-preview:large',
      path: '/',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'TinyFinder',
          url: SITE_URL,
          description:
            'Guided opportunity search for jobs, scholarships, grants, and visa pathways.',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${SITE_URL}/auth?next=%2Fnew-search`,
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'TinyFinder',
          url: SITE_URL,
          logo: `${SITE_URL}/favicon.svg`,
        },
      ],
    };
  }

  if (pathname === '/auth') {
    return {
      title: 'Access TinyFinder | Sign In to Your Search Workspace',
      description:
        'Sign in to TinyFinder to save searches, revisit results, and continue guided opportunity discovery.',
      robots: 'noindex, nofollow',
      path: '/auth',
    };
  }

  if (pathname.startsWith('/new-search')) {
    return {
      title: 'Search Workspace | TinyFinder',
      description:
        'Run guided TinyFinder searches for jobs, scholarships, grants, and visa pathways from one workspace.',
      robots: 'noindex, nofollow',
      path: pathname,
    };
  }

  if (pathname.startsWith('/intake/')) {
    return {
      title: 'Search Intake | TinyFinder',
      description:
        'Add your criteria to run a guided TinyFinder search tailored to your goals and destination.',
      robots: 'noindex, nofollow',
      path: pathname,
    };
  }

  if (pathname.startsWith('/session/')) {
    return {
      title: 'Saved Search Session | TinyFinder',
      description: 'Review a saved TinyFinder search session and continue your opportunity research.',
      robots: 'noindex, nofollow',
      path: pathname,
    };
  }

  if (pathname.startsWith('/report/')) {
    return {
      title: 'Search Report | TinyFinder',
      description: 'Open a TinyFinder report to review organized opportunity results and next steps.',
      robots: 'noindex, nofollow',
      path: pathname,
    };
  }

  if (pathname.startsWith('/profile')) {
    return {
      title: 'Profile Settings | TinyFinder',
      description: 'Manage your TinyFinder profile, preferences, and saved search settings.',
      robots: 'noindex, nofollow',
      path: pathname,
    };
  }

  return {
    title: 'TinyFinder',
    description: 'Guided opportunity search for jobs, scholarships, grants, and visa pathways.',
    robots: 'noindex, nofollow',
    path: pathname,
  };
}

export function Seo() {
  const location = useLocation();

  React.useEffect(() => {
    const seo = buildSeoConfig(location.pathname);
    const canonicalUrl = `${SITE_URL}${seo.path}`;

    document.title = seo.title;

    ensureMeta('meta[name="description"]', { name: 'description', content: seo.description });
    ensureMeta('meta[name="robots"]', { name: 'robots', content: seo.robots });
    ensureMeta('meta[name="theme-color"]', { name: 'theme-color', content: '#111827' });
    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    ensureMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'TinyFinder' });
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title });
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: seo.description });
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    ensureMeta('meta[property="og:image"]', { property: 'og:image', content: SOCIAL_IMAGE_URL });
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
    ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: SOCIAL_IMAGE_URL });
    ensureLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });
    ensureStructuredData(seo.jsonLd);
  }, [location.pathname]);

  return null;
}
