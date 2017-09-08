import React, { PureComponent } from 'react'
import Analytics from 'react-ga'
import Head from 'next/head'

import Layout from 'client/components/Layout'
import BarGraph from 'client/components/BarGraph'
import AutocompleteInput from 'client/components/AutocompleteInput'
import ProgressSquare from 'client/components/ProgressSquare/ProgressSquare'
import Router from 'next/router'
import Link from 'next/link'
import isEmptyObject from 'is-empty-object'
import sortBy from 'lodash.sortby'
import Stat from './Stat'

import API from 'client/api'

import GithubLogo from '../../assets/github-logo.svg'
import EmptyBox from '../../assets/empty-box.svg'
import stylesheet from './ResultPage.scss'

export default class ResultPage extends PureComponent {
  state = {
    results: {},
    resultsPromiseState: null,
    resultsError: null,
    historicalResultsPromiseState: null,
    inputInitialValue: this.props.url.query.p || '',
    historicalResults: [],
  }

  // Picked up from http://www.webpagetest.org/
  // Speed in KB/s
  static downloadSpeed = {
    TWO_G: 30,     // 2G Edge
    THREE_G: 50    // Emerging markets 3G
  }

  componentDidMount() {
    Analytics.pageview(window.location.pathname)
    const { url: { query } } = this.props

    if (query.p && query.p.trim()) {
      this.handleSearchSubmit(query.p.trim())
    }
  }

  fetchResults = (packageString) => {
    const startTime = Date.now()

    API.getInfo(packageString)
      .then(results => {
        const newPackageString = `${results.name}@${results.version}`
        this.setState({
          inputInitialValue: newPackageString,
          results,
        }, () => {
          Router.replace(`/result?p=${newPackageString}`)
          Analytics.pageview(window.location.pathname)
        })

        Analytics.event({
          category: 'Search',
          action: 'Search Success',
          label: packageString,
        })

        Analytics.timing({
          category: 'Search',
          variable: 'result',
          value: Date.now() - startTime,
          label: packageString,
        });
      })
      .catch(err => {
        this.setState({
          resultsError: err,
          resultsPromiseState: 'rejected',
        })
        console.error(err)

        Analytics.event({
          category: 'Search',
          action: 'Search Failure',
          label: packageString,
        })

        Analytics.exception({
          description: err.error ? err.error.code : err.toString(),
        })
      })
  }

  fetchHistory = (packageString) => {
    API.getHistory(packageString)
      .then(results => {
        this.setState({
          historicalResultsPromiseState: 'fulfilled',
          historicalResults: results,
        })
      })
      .catch(err => {
        this.setState({ historicalResultsPromiseState: 'rejected' })
        console.error(err)
      })
  }

  handleSearchSubmit = (packageString) => {
    Analytics.event({
      category: 'Search',
      action: 'Searched',
      label: packageString,
    })

    this.setState({
      results: {},
      historicalResultsPromiseState: 'pending',
      resultsPromiseState: 'pending',
    })

    Router.replace(`/result?p=${packageString}`)

    this.fetchResults(packageString)
    this.fetchHistory(packageString)
  }

  handleProgressDone = () => {
    this.setState({
      resultsPromiseState: 'fulfilled',
    })
  }

  formatHistoricalResults = () => {
    const { results, historicalResults } = this.state
    const totalVersions = {
      ...historicalResults,
      [results.version]: results,
    }

    const formattedResults = Object.keys(totalVersions)
      .map(version => {
        if (isEmptyObject(totalVersions[version])) {
          return { version, disabled: true }
        }
        return {
          version,
          size: totalVersions[version].size,
          gzip: totalVersions[version].gzip,
        }
      })
    const sorted = sortBy(formattedResults, ['version'])
    return (typeof window !== 'undefined' && window.innerWidth < 640) ?
      sorted.slice(-10) : sorted
  }

  handleBarClick = (reading) => {
    const { results } = this.state

    const packageString = `${results.name}@${reading.version}`
    this.setState({ inputInitialValue: packageString })
    this.handleSearchSubmit(packageString)

    Analytics.event({
      category: 'Graph',
      action: reading.disabled ? 'Graph Disabled Bar Click' : 'Graph Bar Click',
      label: packageString,
    })
  }

  render() {
    const {
      inputInitialValue,
      resultsPromiseState,
      resultsError,
      historicalResultsPromiseState,
      results,
    } = this.state

    return (
      <Layout className="result-page">
        <style dangerouslySetInnerHTML={ { __html: stylesheet } } />
        {
          resultsPromiseState === 'fulfilled' && (
            <Head>
              <title>
                { results.name }@{ results.version } | BundlePhobia
              </title>
            </Head>
          )
        }
        <div className="page-container">
          <header className="result-header">
            <section className="result-header--left-section">
              <Link href="/">
                <a>
                  <div className="logo-small">
                    <span>Bundle</span>
                    <span className="logo-small__alt">Phobia</span>
                  </div>
                </a>
              </Link>
            </section>
            <section className="result-header--right-section">
              <a target="_blank" href="https://github.com/pastelsky/bundlephobia">
                <GithubLogo />
              </a>
            </section>
          </header>
          <div className="result__search-container">
            <AutocompleteInput
              key={ inputInitialValue }
              initialValue={ inputInitialValue }
              className="result-header__search-input"
              onSearchSubmit={ this.handleSearchSubmit }
            />
          </div>
          {
            resultsPromiseState === 'pending' && (
              <ProgressSquare
                isDone={ !!results.version }
                onDone={ this.handleProgressDone }
              />
            )
          }
          {
            resultsPromiseState === 'fulfilled' &&
            (results.hasJSModule || results.hasJSNext) && (
              <div className="flash-message">
                <span className="flash-message__info-icon">
                  i
                </span>
                <span>
                supports the&nbsp;
                  <code>
                  { results.hasJSModule ? 'module' : 'jsnext:main' }
                </code>
                  &nbsp;field. You can get smaller sizes with
                  &nbsp;
                  <a href="http://2ality.com/2017/04/setting-up-multi-platform-packages.html#support-by-bundlers">tree shaking</a>.
                </span>
              </div>
            )
          }
          {
            resultsPromiseState === 'fulfilled' && (
              <section className="content-container">
                <div className="stats-container">
                  <div className="size-container">
                    <h3> Bundle Size </h3>
                    <div className="size-stats">
                      <Stat
                        value={ results.size }
                        type={ Stat.type.SIZE }
                        label="Minified"
                      />
                      <Stat
                        value={ results.gzip }
                        type={ Stat.type.SIZE }
                        label="Minified + Gzipped"
                      />
                    </div>
                  </div>
                  <div className="time-container">
                    <h3> Download Time </h3>
                    <div className="time-stats">
                      <Stat
                        value={ results.gzip / 1024 / ResultPage.downloadSpeed.TWO_G }
                        type={ Stat.type.TIME }
                        label="2G Edge"
                        infoText={ `Download Speed: ⬇️ ${ResultPage.downloadSpeed.TWO_G} kB/s` }
                      />
                      <Stat
                        value={ results.gzip / 1024 / ResultPage.downloadSpeed.THREE_G }
                        type={ Stat.type.TIME }
                        label="Emerging 3G"
                        infoText={ `Download Speed: ⬇️ ${ResultPage.downloadSpeed.THREE_G} kB/s` }
                      />
                    </div>
                  </div>
                </div>
                <div className="chart-container">
                  {
                    historicalResultsPromiseState === 'fulfilled' && (
                      <BarGraph
                        onBarClick={ this.handleBarClick }
                        readings={ this.formatHistoricalResults() }
                      />
                    )
                  }
                </div>
              </section>
            )
          }
          {
            resultsPromiseState === 'rejected' && (
              <div className="result-error">
                <EmptyBox className="result-error__img" />
                <h2 className="result-error__code">
                  { resultsError.error.code }
                </h2>
                <p className="result-error__message">
                  { resultsError.error ? resultsError.error.message :
                    'Something went wrong!' }
                </p>
              </div>
            )
          }
        </div>
      </Layout>
    )
  }
}