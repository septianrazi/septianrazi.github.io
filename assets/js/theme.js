/*!
 * Septian Razi - Theme & Interaction Script
 */

(() => {
    'use strict'

    // --- Theme Management ---
    const getStoredTheme = () => localStorage.getItem('theme')
    const setStoredTheme = theme => localStorage.setItem('theme', theme)
    
    const getPreferredTheme = () => {
        const storedTheme = getStoredTheme()
        if (storedTheme) return storedTheme
        return 'light'
    }

    const setTheme = theme => {
        document.documentElement.setAttribute('data-bs-theme', theme)
    }

    // Initial theme set
    setTheme(getPreferredTheme())

    window.addEventListener('DOMContentLoaded', () => {
        const themeToggle = document.querySelector('#bd-theme')
        if (!themeToggle) return

        const updateToggleUI = (theme) => {
            const icon = themeToggle.querySelector('i')
            if (theme === 'dark') {
                icon.className = 'bi bi-moon-stars-fill'
                themeToggle.setAttribute('aria-label', 'Switch to light mode')
            } else {
                icon.className = 'bi bi-sun-fill'
                themeToggle.setAttribute('aria-label', 'Switch to dark mode')
            }
        }

        updateToggleUI(getPreferredTheme())

        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-bs-theme')
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
            setStoredTheme(newTheme)
            setTheme(newTheme)
            updateToggleUI(newTheme)
        })

        // --- Intersection Observer for Animations ---
        const revealCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible')
                    // Once visible, we can stop observing this element
                    observer.unobserve(entry.target)
                }
            })
        }

        const revealObserver = new IntersectionObserver(revealCallback, {
            threshold: 0.15
        })

        const revealElements = document.querySelectorAll('.fade-in')
        revealElements.forEach(el => revealObserver.observe(el))

        // --- Back to Top Button ---
        const backToTop = document.createElement('button')
        backToTop.id = 'back-to-top'
        backToTop.innerHTML = '<i class="bi bi-arrow-up"></i>'
        backToTop.className = 'btn btn-primary rounded-circle shadow neumorphic'
        document.body.appendChild(backToTop)

        window.addEventListener('scroll', () => {
            if (window.scrollY > 500) {
                backToTop.classList.add('show')
            } else {
                backToTop.classList.remove('show')
            }
        })

        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        })
    })
})()
