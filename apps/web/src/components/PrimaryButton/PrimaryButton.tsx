import '../WelcomeLayout/WelcomeLayout.css'

type PrimaryButtonProps = {
  children: string
  type?: 'button' | 'submit'
  form?: string
  onClick?: () => void
  disabled?: boolean
  tabIndex?: number
}

function ArrowIcon() {
  return (
    <svg
      className="welcome__button-arrow"
      width="18"
      height="12"
      viewBox="0 0 18 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10.0586 12C9.7412 12 9.43748 11.9266 9.14844 11.7812C8.78735 11.5775 8.49911 11.2549 8.33984 10.876C8.23862 10.6139 8.07985 9.8304 8.0791 9.8125C7.93309 9.01839 7.84908 7.76483 7.83691 6.36035L7.83496 6.00684C7.83496 4.5352 7.92096 3.19297 8.05078 2.31836L8.16504 1.77441C8.22829 1.48651 8.31079 1.15858 8.39746 0.991211C8.71484 0.378905 9.33582 0.000175476 10 0H10.0586C10.4898 0.0144262 11.393 0.390695 11.4014 0.407227C12.8654 1.02151 15.6897 2.87561 16.9941 4.19727L17.373 4.59375C17.4722 4.70121 17.5841 4.82856 17.6533 4.92773C17.8846 5.23393 18 5.6133 18 5.99219C18 6.41504 17.8703 6.80829 17.625 7.12988L17.2354 7.55078L17.1484 7.64062C15.9648 8.9239 12.8735 11.0219 11.2568 11.6641L11.0127 11.7578C10.7191 11.863 10.308 11.9883 10.0586 12ZM1.50293 7.51758C0.673052 7.5174 0.000236511 6.83795 0 6C0 5.16185 0.672907 4.48162 1.50293 4.48145L5.20215 4.80859C5.85341 4.80859 6.38184 5.34239 6.38184 6C6.3816 6.65851 5.85327 7.19043 5.20215 7.19043L1.50293 7.51758Z"
        fill="white"
      />
    </svg>
  )
}

export function PrimaryButton({
  children,
  type = 'button',
  form,
  onClick,
  disabled,
  tabIndex,
}: PrimaryButtonProps) {
  return (
    <div className="welcome__cta">
      <span className="welcome__button-shadow" aria-hidden="true" />
      <button
        type={type}
        form={form}
        className="welcome__button"
        onClick={onClick}
        disabled={disabled}
        tabIndex={tabIndex}
      >
        <span className="welcome__button-label">{children}</span>
        <ArrowIcon />
      </button>
    </div>
  )
}
