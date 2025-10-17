'use client';

import React from 'react';

export default function OpenSourceSection() {
  const scrollToProject = () => {
    const element = document.getElementById('pricing');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  const projects = [
    {
      title: 'Personal & Startup Finance System',
      oneLiner: 'A clean ledger + workflow backbone to get out of spreadsheets and into real reporting.',
      bullets: [
        'Ingests and normalizes transactions across accounts',
        'Real-time dashboards and simple month-end',
        'Modular pipeline that is easy to extend'
      ],
      stack: ['Python', 'SQL', 'Next.js', 'Open Core'],
      repo: 'Temple-Stuart/temple-stuart-accounting',
      featured: 'Open Core',
      image: '/images/projects/accounting-hero.png',
      caseStudy: '#'
    },
    {
      title: 'News & Signal Engine',
      oneLiner: 'Pull in articles, clean them up, and ship structured signals you can use anywhere.',
      bullets: [
        'Source to clean to enrich to score to output',
        'Built for fast iteration and reproducibility',
        'Plug into alerts, dashboards, or downstream analytics'
      ],
      stack: ['Python', 'NLP', 'CLI/API', 'Open Core'],
      repo: 'stonkyoloer/News_Spread_Engine',
      featured: 'Featured in Media',
      image: '/images/projects/news-engine-hero.png',
      caseStudy: '#'
    }
  ];

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12 lg:mb-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b4b237] mb-2">
            Open-Core Projects
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light text-gray-900 mb-4">
            Case Studies
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Real systems I've built and open-sourced. See how they work, what they solve, and how you can use them.
          </p>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {projects.map((project, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-2xl transition-all duration-300"
            >
              {/* Featured Badge */}
              {project.featured && (
                <div className="px-6 pt-6">
                  <span className={`inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${
                    project.featured === 'Open Core'
                      ? 'bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white'
                      : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white'
                  }`}>
                    {project.featured}
                  </span>
                </div>
              )}

              {/* Content */}
              <div className="p-6 space-y-6">

                {/* Title & One-liner */}
                <div>
                  <h3 className="text-2xl font-light text-gray-900 mb-2">
                    {project.title}
                  </h3>
                  <p className="text-gray-600">
                    {project.oneLiner}
                  </p>
                </div>

                {/* Bullets */}
                <ul className="space-y-2">
                  {project.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start text-sm text-gray-700">
                      <span className="text-[#b4b237] mr-2">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                {/* Stack */}
                <div className="flex flex-wrap gap-2">
                  {project.stack.map((tech, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 text-xs font-medium uppercase tracking-wider bg-gray-100 text-gray-700 rounded-full"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                {/* Metrics */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <img
                    src={`https://img.shields.io/github/stars/${project.repo}?style=flat`}
                    alt={`${project.title} stars`}
                    className="h-5"
                  />
                  <img
                    src={`https://img.shields.io/github/forks/${project.repo}?style=flat`}
                    alt={`${project.title} forks`}
                    className="h-5"
                  />
                  <img
                    src={`https://img.shields.io/github/last-commit/${project.repo}?style=flat`}
                    alt={`${project.title} last commit`}
                    className="h-5"
                  />
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={scrollToProject}
                    className="flex-1 py-3 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-xl hover:shadow-xl transition-all"
                  >
                    Build Something Like This
                  </button>
                  <a
                    href={`https://github.com/${project.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:border-[#b4b237] hover:text-[#b4b237] transition-all text-center"
                  >
                    View Repo
                  </a>
                </div>

                <a
                  href={project.caseStudy}
                  className="block w-full py-3 text-center text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
                >
                  Read Case Study →
                </a>

              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
